/**
 * @param {string} fileUrl
 */
export function triggerDirectFileDownload(fileUrl) {
  const href = String(fileUrl || "").trim();
  if (!href) throw new Error("Download URL is missing");
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener noreferrer";
  a.target = "_blank";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Start a PPTX download without buffering the file in JavaScript.
 * Uses same-origin API URL; server may redirect to Alai CDN when allowed.
 *
 * @param {string} apiDownloadUrl — e.g. `/api/generate-slides/{id}/download?...`
 */
export function triggerSlidePptxApiDownload(apiDownloadUrl) {
  const href = String(apiDownloadUrl || "").trim();
  if (!href) throw new Error("Download URL is missing");

  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * @param {string} baseDownloadUrl
 * @param {{ title?: string; provider?: string }} [opts]
 */
export function buildSlidePptxDownloadUrl(
  baseDownloadUrl,
  { title = "presentation", provider = "alai" } = {},
) {
  const u = new URL(baseDownloadUrl, window.location.origin);
  if (title) u.searchParams.set("title", title);
  if (provider) u.searchParams.set("provider", provider);
  return u.pathname + u.search;
}
