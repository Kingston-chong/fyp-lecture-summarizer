/**
 * Short label for a quoted chat excerpt (composer + sent message UI).
 * @param {string} text
 * @param {number} [maxLen]
 */
export function formatReplyExcerptLabel(text, maxLen = 56) {
  const oneLine = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!oneLine) return "Excerpt";
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}
