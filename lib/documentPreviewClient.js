/**
 * Client helpers for in-app document preview.
 */

import { isTextPreviewName } from "@/app/dashboard/helpers";

/** @param {{ name?: string, sourceUrl?: string | null }} doc */
export function shouldUseTextDocumentPreview(doc) {
  if (!doc) return false;
  if (doc.sourceUrl) return true;
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
