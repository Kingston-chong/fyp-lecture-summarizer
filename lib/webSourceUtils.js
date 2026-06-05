/** @param {string} title */
export function sanitizeWebSourceFileName(title) {
  const base = String(title || "Web page")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const stem = base || "Web page";
  return stem.toLowerCase().endsWith(".txt") ? stem : `${stem}.txt`;
}

/** @param {string} urlStr */
export function domainFromSourceUrl(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
