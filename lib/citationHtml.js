/**
 * Post-process summary HTML: paragraph IDs and clickable citation markers.
 */

const CITE_MARKER_RE = /\[(\d{1,3})\]/g;

/**
 * Add id="para-N" to paragraph tags in order.
 * @param {string} html
 */
export function addParagraphIds(html) {
  let paraIndex = 0;
  return String(html || "").replace(/<p>/gi, () => {
    const id = `para-${paraIndex}`;
    paraIndex += 1;
    return `<p id="${id}">`;
  });
}

/**
 * Turn [n] into superscript links to #ref-n (skip text inside existing tags roughly).
 * @param {string} html
 * @param {number} maxMarker
 */
export function linkCitationMarkers(html, maxMarker = 99) {
  return String(html || "").replace(CITE_MARKER_RE, (full, num) => {
    const n = parseInt(num, 10);
    if (n < 1 || n > maxMarker) return full;
    return `<sup><a href="#ref-${n}" class="cite-marker" data-marker="${n}">[${n}]</a></sup>`;
  });
}

/**
 * Enrich summary body HTML only (call before appending References block).
 * @param {string} bodyHtml
 * @param {number} maxMarker
 */
export function enrichSummaryBodyHtml(bodyHtml, maxMarker = 99) {
  let out = addParagraphIds(bodyHtml);
  out = linkCitationMarkers(out, maxMarker);
  return out;
}

/**
 * @param {string} markdown
 * @param {string} html
 * @param {number} maxMarker
 */
export function enrichSummaryHtml(markdown, html, maxMarker = 99) {
  const htmlStr = String(html || "");
  const refSplit = htmlStr.match(/(<h2[^>]*>References<\/h2>[\s\S]*)$/i);
  if (refSplit) {
    const body = htmlStr.slice(0, refSplit.index);
    const refs = refSplit[1];
    return enrichSummaryBodyHtml(body, maxMarker) + refs;
  }
  return enrichSummaryBodyHtml(htmlStr, maxMarker);
}
