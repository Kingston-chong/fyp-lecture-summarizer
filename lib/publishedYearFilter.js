/**
 * Publication year filter for lecturer-mode academic reference search.
 */

export const PUBLISHED_YEAR_PRESETS = [
  { id: "all", label: "All years" },
  { id: "since2026", label: "Since 2026" },
  { id: "since2025", label: "Since 2025" },
  { id: "since2022", label: "Since 2022" },
  { id: "custom", label: "Custom range" },
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;
const MAX_YEAR = CURRENT_YEAR + 1;

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseYearInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < MIN_YEAR || n > MAX_YEAR) return null;
  return n;
}

/**
 * @param {{ mode?: string; from?: unknown; to?: unknown; publishedYearFrom?: unknown; publishedYearTo?: unknown }} input
 * @returns {{ from: number | null; to: number | null; active: boolean }}
 */
export function resolvePublishedYearRange(input = {}) {
  const mode = String(input.mode || "").trim().toLowerCase();

  if (mode === "since2026") return { from: 2026, to: null, active: true };
  if (mode === "since2025") return { from: 2025, to: null, active: true };
  if (mode === "since2022") return { from: 2022, to: null, active: true };

  if (mode === "custom" || input.publishedYearFrom != null || input.publishedYearTo != null) {
    const from =
      parseYearInput(input.from ?? input.publishedYearFrom) ?? null;
    const to = parseYearInput(input.to ?? input.publishedYearTo) ?? null;
    if (from == null && to == null) {
      return { from: null, to: null, active: false };
    }
    if (from != null && to != null && from > to) {
      return { from: to, to: from, active: true };
    }
    return { from, to, active: true };
  }

  return { from: null, to: null, active: false };
}

/**
 * @param {{ from: number | null; to: number | null; active?: boolean }} range
 * @returns {string}
 */
export function formatPublishedYearRangeLabel(range) {
  if (!range?.active) return "All years";
  const { from, to } = range;
  if (from != null && to != null) return `${from} – ${to}`;
  if (from != null) return `Since ${from}`;
  if (to != null) return `Through ${to}`;
  return "All years";
}

/**
 * @param {{ year?: number | null }} paper
 * @param {{ from: number | null; to: number | null; active?: boolean }} range
 */
export function paperMatchesPublishedYear(paper, range) {
  if (!range?.active) return true;
  const y = paper?.year;
  if (y == null || !Number.isFinite(Number(y))) return false;
  const year = Number(y);
  if (range.from != null && year < range.from) return false;
  if (range.to != null && year > range.to) return false;
  return true;
}

/**
 * @param {Array<{ year?: number | null }>} papers
 * @param {{ from: number | null; to: number | null; active?: boolean }} range
 */
export function filterPapersByPublishedYear(papers, range) {
  if (!range?.active) return papers || [];
  return (papers || []).filter((p) => paperMatchesPublishedYear(p, range));
}

/**
 * OpenAlex filter fragment for publication year (best-effort).
 * @param {{ from: number | null; to: number | null; active?: boolean }} range
 * @returns {string | null}
 */
export function openAlexYearFilterParam(range) {
  if (!range?.active) return null;
  const parts = [];
  if (range.from != null) parts.push(`publication_year:>${range.from - 1}`);
  if (range.to != null) parts.push(`publication_year:<${range.to + 1}`);
  return parts.length ? parts.join(",") : null;
}

/**
 * @param {{ from: number | null; to: number | null }} range
 * @returns {Record<string, number | null>}
 */
export function publishedYearPayload(range) {
  if (!range?.active) {
    return { publishedYearFrom: null, publishedYearTo: null };
  }
  return {
    publishedYearFrom: range.from,
    publishedYearTo: range.to,
  };
}
