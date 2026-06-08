/**
 * Pure citation-marker parsing (no app imports — safe for node --test).
 */

export const CITE_MARKER_RE = /\[(\d{1,3})\]/g;

/** @param {string} markdown */
export function stripReferencesSection(markdown) {
  const m = String(markdown || "");
  const idx = m.search(/\n#{1,3}\s*references\s*\n/i);
  if (idx === -1) return m.trimEnd();
  return m.slice(0, idx).trimEnd();
}

/**
 * @param {string} markdown
 * @returns {number[]}
 */
export function extractCitationMarkers(markdown) {
  const body = stripReferencesSection(markdown);
  const found = new Set();
  let m;
  const re = new RegExp(CITE_MARKER_RE.source, "g");
  while ((m = re.exec(body))) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 999) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * @param {object[]} references
 * @param {string} markdown
 */
export function filterReferencesToCitedInBody(references, markdown) {
  const cited = new Set(extractCitationMarkers(markdown));
  return (references || []).filter((r) => cited.has(Number(r.marker)));
}

/**
 * Remove inline [n] markers not in the allowed set. When allowed is empty, strip all.
 * @param {string} markdown
 * @param {Iterable<number>} allowedMarkers
 */
export function stripCitationMarkersNotInSet(markdown, allowedMarkers) {
  const allowed = new Set(allowedMarkers);
  if (allowed.size === 0) {
    return String(markdown || "").replace(CITE_MARKER_RE, "");
  }
  return String(markdown || "").replace(CITE_MARKER_RE, (full, num) => {
    const n = parseInt(num, 10);
    return allowed.has(n) ? full : "";
  });
}
