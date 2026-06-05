import { ALLOWED_EXTENSIONS, extensionFromName } from "./documentUpload.js";
import {
  assertFetchableDocumentUrl,
  fetchRemoteDocument,
} from "./fetchRemoteDocument.js";
import { formatUploadLimitLabel } from "./uploadLimits.js";
import { sanitizeWebSourceFileName } from "./webSourceUtils.js";

export { sanitizeWebSourceFileName };

const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";

const FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const WEBPAGE_EXTRACT_MAX_CHARS = Number.parseInt(
  process.env.WEBPAGE_EXTRACT_MAX_CHARS || "80000",
  10,
);

const DIRECT_FILE_EXT = new Set([
  "pdf",
  "pptx",
  "ppt",
  "docx",
  "doc",
  "txt",
  "xlsx",
  "xls",
  "csv",
  "md",
]);

/** @param {string} urlStr */
export function isDirectFileUrl(urlStr) {
  try {
    const path = new URL(urlStr).pathname;
    const segment = path.split("/").filter(Boolean).pop() || "";
    const ext = segment.includes(".")
      ? segment.split(".").pop().toLowerCase()
      : "";
    return DIRECT_FILE_EXT.has(ext);
  } catch {
    return false;
  }
}

/** @param {string} html */
function titleFromHtml(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ""));
  if (!m) return null;
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** @param {string} html */
function textFromHtml(html) {
  let s = String(html || "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|footer)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return s
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** @param {string} text @param {number} maxChars */
function trimExtractedText(text, maxChars) {
  const t = String(text || "").trim();
  if (!t) return "";
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars).trim()}\n\n[Content truncated for size limit.]`;
}

/**
 * @param {string} url
 * @returns {Promise<{ title: string, text: string, method: string } | null>}
 */
async function extractViaTavily(url) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(TAVILY_EXTRACT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      urls: [url],
      include_images: false,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    console.warn("Tavily extract HTTP error:", res.status);
    return null;
  }

  const data = await res.json().catch(() => ({}));
  const results = Array.isArray(data?.results) ? data.results : [];
  const hit = results.find((r) => r?.url) || results[0];
  if (!hit) return null;

  const text = String(hit.raw_content || hit.content || "").trim();
  if (!text) return null;

  let title = String(hit.title || "").trim();
  if (!title) {
    try {
      title = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      title = "Web page";
    }
  }

  return { title, text, method: "tavily" };
}

/**
 * @param {string} url
 * @returns {Promise<{ title: string, text: string, method: string }>}
 */
async function extractViaHtmlFetch(url) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "User-Agent": FETCH_UA,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Could not fetch page (${res.status}). Try uploading a PDF instead.`,
    );
  }

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/pdf") || ct.includes("octet-stream")) {
    throw new Error(
      "This link points to a downloadable file. Use Upload files instead.",
    );
  }

  const html = await res.text();
  const title = titleFromHtml(html) || "Web page";
  const text = textFromHtml(html);
  if (!text) {
    throw new Error(
      "Could not extract readable text from this page. Try a different link or upload a PDF.",
    );
  }

  return { title, text, method: "html" };
}

/**
 * Extract readable text from a webpage URL, or download a direct file link.
 * @param {string} sourceUrl
 * @param {{ maxChars?: number }} [options]
 * @returns {Promise<{ sourceUrl: string, title: string, text: string, method: string, file?: { buffer: Buffer, name: string, type: string, size: number } }>}
 */
export async function extractWebSource(sourceUrl, { maxChars } = {}) {
  const url = assertFetchableDocumentUrl(sourceUrl);
  const limit =
    Number.isFinite(maxChars) && maxChars > 0
      ? maxChars
      : WEBPAGE_EXTRACT_MAX_CHARS;

  if (isDirectFileUrl(url)) {
    const ext = extensionFromName(
      new URL(url).pathname.split("/").pop() || "",
    );
    if (ALLOWED_EXTENSIONS.has(ext)) {
      const file = await fetchRemoteDocument(url);
      return {
        sourceUrl: url,
        title: file.name.replace(/\.[^/.]+$/, ""),
        text: "",
        method: "file",
        file,
      };
    }
  }

  const tavily = await extractViaTavily(url);
  const extracted = tavily || (await extractViaHtmlFetch(url));
  const text = trimExtractedText(extracted.text, limit);
  if (!text) {
    throw new Error("No readable text could be extracted from this page.");
  }

  return {
    sourceUrl: url,
    title: extracted.title,
    text,
    method: extracted.method,
  };
}

/** @param {number} byteLength */
export function formatWebExtractSizeWarning(byteLength) {
  if (byteLength <= 0) return null;
  return `Extracted ${formatUploadLimitLabel(byteLength)} of text.`;
}
