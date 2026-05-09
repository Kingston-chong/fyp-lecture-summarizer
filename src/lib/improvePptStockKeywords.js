/**
 * Build a short Unsplash search query from slide text (title, bullets, original deck text).
 * Strips stopwords and keeps order of first meaningful tokens.
 */

const STOP = new Set(
  `a an the and or but if in on at to for of as is was are were be been being
   it this that these those with from by into about above after before between
   through during without within across against among under over out off up down
   all any some no not only same so than then too very can could should would will
   may might must shall do does did done having have has had get got go going went
   use used using make made such each few more most other such per via vs etc
   slide slides page topic introduction conclusion summary overview lecture notes
   bullet point points key keys example examples definition definitions`
    .split(/\s+/)
    .filter(Boolean),
);

const MAX_QUERY_LEN = 100;
const MAX_TOKENS = 10;
const MIN_TOKEN_LEN = 2;

// Words that produce misleading or inappropriate stock results when searched alone
// or in short combinations. These are stripped from the final query.
const RISKY_TOKENS = new Set([
  "system", "hack", "kill", "destroy", "abuse", "attack", "trap",
  "drug", "bomb", "weapon", "gun", "illegal", "pirate", "explicit",
]);

/**
 * @param {{ title?: string; lines?: string[] }} slide Improved slide from LLM
 * @param {{ text?: string; lines?: string[] } | null | undefined} sourceSlide Original slide from parse (same index)
 * @returns {string} query or "" if nothing usable
 */
export function buildStockPhotoQueryFromSlide(slide, sourceSlide) {
  const chunks = [];
  const t = String(slide?.title || "").trim();
  if (t && !/^slide\s*\d+$/i.test(t)) chunks.push(t);
  for (const line of slide?.lines || []) {
    const s = String(line || "").trim();
    if (s) chunks.push(s);
  }
  if (sourceSlide) {
    const tx = String(sourceSlide.text || "").trim();
    if (tx) chunks.push(tx.slice(0, 600));
    for (const line of sourceSlide.lines || []) {
      const s = String(line || "").trim();
      if (s) chunks.push(s);
    }
  }

  const raw = chunks.join(" ").toLowerCase();
  const normalized = raw.replace(/[^a-z0-9]+/gi, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);

  const picked = [];
  const seen = new Set();
  for (const tok of tokens) {
    if (tok.length < MIN_TOKEN_LEN) continue;
    if (STOP.has(tok)) continue;
    if (RISKY_TOKENS.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    picked.push(tok);
    if (picked.length >= MAX_TOKENS) break;
  }

  let q = picked.join(" ").trim();
  if (!q) {
    const fallback = String(slide?.title || "").replace(/^slide\s*\d+\s*/i, "").trim();
    q = fallback.slice(0, MAX_QUERY_LEN).trim();
  }
  return q.slice(0, MAX_QUERY_LEN);
}