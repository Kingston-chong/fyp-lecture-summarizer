"use client";

import { upload } from "@vercel/blob/client";
import { sanitizeWebSourceFileName } from "./webSourceUtils.js";

/**
 * Extract a webpage (or direct file URL) and materialize as a summarize source.
 * @param {string} url
 * @param {{ isGuest?: boolean }} [options]
 * @returns {Promise<{ kind: "document", document: object } | { kind: "file", file: File, sourceUrl: string, method: string, warning?: string | null }>}
 */
export async function importWebSourceAsDocument(url, { isGuest = false } = {}) {
  const res = await fetch("/api/sources/webpage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: String(url || "").trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not import from link");
  }

  if (data.method === "file" && data.file?.data) {
    const binary = atob(data.file.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const file = new File([bytes], data.file.name, {
      type: "application/octet-stream",
    });
    if (isGuest) {
      return {
        kind: "file",
        file,
        sourceUrl: data.sourceUrl || url,
        method: "file",
      };
    }
    const uploaded = await uploadDocumentsViaClientWithSourceUrl([file], {
      sourceUrl: data.sourceUrl || url,
    });
    return { kind: "document", document: uploaded[0] };
  }

  const fileName = sanitizeWebSourceFileName(data.title);
  const text = String(data.text || "");
  const file = new File([text], fileName, { type: "text/plain" });
  const warning =
    data.method === "html"
      ? "Basic extraction was used. Quality may be lower on complex pages."
      : null;

  if (isGuest) {
    return {
      kind: "file",
      file,
      sourceUrl: data.sourceUrl || url,
      method: data.method || "web",
      warning,
    };
  }

  const uploaded = await uploadDocumentsViaClientWithSourceUrl([file], {
    sourceUrl: data.sourceUrl || url,
  });
  return {
    kind: "document",
    document: uploaded[0],
    warning,
  };
}

/**
 * @param {File[]} files
 * @param {{ sourceUrl?: string }} [options]
 */
async function uploadDocumentsViaClientWithSourceUrl(
  files,
  { sourceUrl } = {},
) {
  const uploaded = [];
  for (const file of files) {
    const prepRes = await fetch("/api/upload/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        shouldRename: false,
      }),
    });
    const prep = await prepRes.json().catch(() => ({}));
    if (!prepRes.ok) {
      throw new Error(prep.error || "Could not prepare upload");
    }

    const blob = await upload(prep.pathname, file, {
      access: "private",
      handleUploadUrl: "/api/upload/client",
      multipart: file.size > 5 * 1024 * 1024,
      clientPayload: JSON.stringify({ finalName: prep.finalName }),
    });

    const regRes = await fetch("/api/upload/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: blob.url,
        pathname: blob.pathname,
        name: prep.finalName,
        size: file.size,
        type: prep.type,
        ...(sourceUrl ? { sourceUrl } : {}),
      }),
    });
    const reg = await regRes.json().catch(() => ({}));
    if (!regRes.ok) {
      throw new Error(reg.error || "Could not save uploaded file");
    }
    uploaded.push(reg.document);
  }
  return uploaded;
}

/**
 * Search the web for candidate source pages.
 * @param {string} query
 */
export async function searchWebSources(query) {
  const res = await fetch("/api/sources/web-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: String(query || "").trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Web search failed");
  }
  return data;
}
