/**
 * Client helpers for in-app document preview.
 */

const TEXT_PREVIEW_EXT = new Set(["txt", "md", "csv"]);

/** Plain-text documents shown in a scrollable viewer instead of an iframe. */
export function isTextPreviewName(name) {
  const ext =
    String(name || "")
      .split(".")
      .pop()
      ?.toLowerCase() || "";
  return TEXT_PREVIEW_EXT.has(ext);
}

/** @param {{ name?: string, sourceUrl?: string | null }} doc */
export function shouldUseTextDocumentPreview(doc) {
  if (!doc) return false;
  return isTextPreviewName(doc.name);
}

/**
 * @param {number} documentId
 * @returns {Promise<string>}
 */
export async function fetchDocumentTextContent(documentId) {
  const res = await fetch(
    `/api/documents/${documentId}/view?v=${Date.now()}`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Could not load preview (${res.status})`);
  }
  return res.text();
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readLocalFileAsText(file) {
  return file.text();
}
