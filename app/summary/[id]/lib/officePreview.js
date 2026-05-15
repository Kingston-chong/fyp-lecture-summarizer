import { isOfficePreviewName } from "@/app/dashboard/helpers";

/**
 * Build Office Online embed + tab URLs from a view URL with optional token.
 */
export function buildOfficeEmbedUrls(viewUrl) {
  const enc = encodeURIComponent(viewUrl);
  return {
    iframeSrc: `https://view.officeapps.live.com/op/embed.aspx?src=${enc}`,
    tabHref: `https://view.officeapps.live.com/op/view.aspx?src=${enc}`,
  };
}

/**
 * Fetch view-token and return preview URLs for a document or slide deck.
 * @param {{ viewTokenPath: string, viewBasePath: string, fileName?: string }} opts
 */
export async function fetchOfficePreviewUrls({
  viewTokenPath,
  viewBasePath,
  fileName,
}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const basePath = viewBasePath.startsWith("/")
    ? viewBasePath
    : `/${viewBasePath}`;

  if (fileName && isOfficePreviewName(fileName)) {
    const res = await fetch(viewTokenPath);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not prepare preview");
    const viewUrl = `${origin}${basePath}?t=${encodeURIComponent(data.token)}`;
    return buildOfficeEmbedUrls(viewUrl);
  }

  const direct = `${origin}${basePath}?v=${Date.now()}`;
  return { iframeSrc: direct, tabHref: `${origin}${basePath}` };
}
