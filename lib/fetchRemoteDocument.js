import {
  ALLOWED_EXTENSIONS,
  extensionFromName,
  MAX_FILE_BYTES,
  SERVERLESS_UPLOAD_MAX_BYTES,
} from "./documentUpload.js";
import { formatUploadLimitLabel } from "./uploadLimits.js";

const FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CONTENT_TYPE_EXT = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
};

/** @param {string} hostname */
function isBlockedHostname(hostname) {
  const h = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return true;
  }
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;

  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(h) ? h.split(".").map(Number) : null;
  if (ipv4) {
    const [a, b] = ipv4;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/** @param {string} urlStr */
export function assertFetchableDocumentUrl(urlStr) {
  const raw = String(urlStr || "").trim();
  if (!raw) throw new Error("Enter a valid http or https URL.");
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Enter a valid http or https link.");
  }
  if (!/^https?:$/i.test(u.protocol)) {
    throw new Error("Only http and https links are supported.");
  }
  if (isBlockedHostname(u.hostname)) {
    throw new Error("That link cannot be fetched from the server.");
  }
  return u.toString();
}

/** @param {string | null} contentDisposition */
export function filenameFromContentDisposition(contentDisposition) {
  const cd = String(contentDisposition || "");
  if (!cd) return null;
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      return star[1].trim();
    }
  }
  const plain = /filename=(?:"([^"]+)"|([^;\s]+))/i.exec(cd);
  return plain ? (plain[1] || plain[2] || "").trim() : null;
}

/** @param {string} urlStr */
function filenameFromUrlPath(urlStr) {
  try {
    const path = new URL(urlStr).pathname;
    const segment = path.split("/").filter(Boolean).pop() || "document";
    return decodeURIComponent(segment);
  } catch {
    return "document";
  }
}

/** @param {string} contentType @param {string} baseName */
function ensureExtension(baseName, contentType) {
  const ext = extensionFromName(baseName);
  if (ALLOWED_EXTENSIONS.has(ext)) return baseName;
  const ct = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const mapped = CONTENT_TYPE_EXT[ct];
  if (!mapped) return baseName;
  const dot = baseName.lastIndexOf(".");
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  return `${stem}.${mapped}`;
}

/**
 * Download a document from a public URL (server-side).
 * @param {string} sourceUrl
 * @param {{ maxBytes?: number }} [options]
 * @returns {Promise<{ buffer: Buffer; name: string; type: string; size: number }>}
 */
export async function fetchRemoteDocument(sourceUrl, { maxBytes } = {}) {
  const url = assertFetchableDocumentUrl(sourceUrl);
  const limit =
    Number.isFinite(maxBytes) && maxBytes > 0
      ? maxBytes
      : MAX_FILE_BYTES;

  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "User-Agent": FETCH_UA,
      Accept:
        "application/pdf,application/vnd.openxmlformats-officedocument.*,application/msword,application/vnd.ms-*,text/plain,text/csv,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Could not download file (${res.status}). Use a direct link to a PDF, PPTX, DOCX, or similar file.`,
    );
  }

  const contentLength = Number(res.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw new Error(
      `File is too large (max ${formatUploadLimitLabel(limit)}).`,
    );
  }

  const ab = await res.arrayBuffer();
  if (!ab.byteLength) {
    throw new Error("The link returned an empty file.");
  }
  if (ab.byteLength > limit) {
    throw new Error(
      `File is too large (max ${formatUploadLimitLabel(limit)}).`,
    );
  }

  const contentType = res.headers.get("content-type") || "";
  let name =
    filenameFromContentDisposition(res.headers.get("content-disposition")) ||
    filenameFromUrlPath(url);
  name = ensureExtension(name, contentType);

  const type = extensionFromName(name);
  if (!ALLOWED_EXTENSIONS.has(type)) {
    throw new Error(
      `Unsupported file type from link. Supported: pdf, pptx, docx, txt, and more.`,
    );
  }

  return {
    buffer: Buffer.from(ab),
    name,
    type,
    size: ab.byteLength,
  };
}

export const GUEST_URL_IMPORT_MAX_BYTES = SERVERLESS_UPLOAD_MAX_BYTES;
