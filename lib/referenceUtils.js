/**
 * Citation parsing and reference persistence for lecturer summaries.
 */

import { buildReferencesSectionFromCatalog } from "@/lib/roleProfiles";

const CITE_MARKER_RE = /\[(\d{1,3})\]/g;

/**
 * Extract unique citation markers used in markdown.
 * @param {string} markdown
 * @returns {number[]}
 */
/** @param {string} markdown */
export function stripReferencesSection(markdown) {
  const m = String(markdown || "");
  const idx = m.search(/\n#{1,3}\s*references\s*\n/i);
  if (idx === -1) return m.trimEnd();
  return m.slice(0, idx).trimEnd();
}

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
 * Keep only catalog entries whose markers appear inline in the summary body.
 * @param {object[]} catalog
 * @param {string} markdown
 */
export function filterCatalogToCitedOnly(catalog, markdown) {
  const anchorMap = buildMarkerAnchorMap(markdown);
  const cited = new Set(anchorMap.keys());
  return (catalog || []).filter((r) => cited.has(r.marker));
}

/**
 * Uploads are numbered in the LLM catalog as [1]…[k] but are not persisted to
 * SummaryReference — they already appear under Sources.
 * @param {object[]} catalog
 */
export function filterOutUploadReferences(catalog) {
  return (catalog || []).filter((r) => r.kind !== "upload");
}

/**
 * Rebuild ## References from markers actually cited in the body (not the full search catalog).
 * Upload citations are omitted from the bibliography text; see Sources for files.
 * @param {string} markdown
 * @param {object[]} fullCatalog
 */
export function finalizeLecturerReferences(markdown, fullCatalog) {
  const anchorMap = buildMarkerAnchorMap(markdown);
  const citedAll = filterCatalogToCitedOnly(fullCatalog, markdown);
  const citedForStorage = filterOutUploadReferences(citedAll);
  const body = stripReferencesSection(markdown);
  const refLines =
    citedForStorage.length > 0
      ? buildReferencesSectionFromCatalog(citedForStorage)
      : citedAll.some((r) => r.kind === "upload")
        ? "- (Uploaded lecture files are listed under Sources; no separate paper references cited.)"
        : "- No inline citations were used in this summary.";
  return {
    markdown: `${body.trim()}\n\n## References\n${refLines}`,
    citedCatalog: citedForStorage,
    anchorMap,
  };
}

/**
 * Map markers to paragraph ids containing them (heuristic reverse jump).
 * @param {string} markdown
 * @returns {Map<number, string[]>}
 */
export function buildMarkerAnchorMap(markdown) {
  const map = new Map();
  const blocks = String(markdown || "").split(/\n\n+/);
  let paraIndex = 0;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^##\s*references\s*$/i.test(trimmed.split("\n")[0])) break;

    const paraId = `para-${paraIndex}`;
    const re = new RegExp(CITE_MARKER_RE.source, "g");
    let m;
    while ((m = re.exec(trimmed))) {
      const n = parseInt(m[1], 10);
      if (!map.has(n)) map.set(n, []);
      const ids = map.get(n);
      if (!ids.includes(paraId)) ids.push(paraId);
    }
    paraIndex += 1;
  }
  return map;
}

/**
 * Strip invalid citation markers above maxMarker.
 * @param {string} markdown
 * @param {number} maxMarker
 */
export function clampInvalidCitations(markdown, maxMarker) {
  if (!maxMarker || maxMarker < 1) return String(markdown || "");
  return String(markdown || "").replace(CITE_MARKER_RE, (full, num) => {
    const n = parseInt(num, 10);
    return n > maxMarker ? "" : full;
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number} summaryId
 * @param {object[]} catalog - from buildReferenceCatalog
 * @param {Map<number, string[]>} anchorMap
 */
export async function persistSummaryReferences(
  prisma,
  summaryId,
  catalog,
  anchorMap,
) {
  await prisma.summaryReference.deleteMany({ where: { summaryId } });

  if (!catalog?.length) return;

  await prisma.summaryReference.createMany({
    data: catalog.map((ref) => ({
      summaryId,
      marker: ref.marker,
      kind: ref.kind,
      title: ref.title.slice(0, 512),
      authors: ref.authors?.slice(0, 512) ?? null,
      year: ref.year ?? null,
      venue: ref.venue?.slice(0, 256) ?? null,
      doi: ref.doi?.slice(0, 128) ?? null,
      url: ref.url?.slice(0, 2048) ?? null,
      abstract: ref.abstract ?? null,
      provider: ref.provider ?? null,
      externalId: ref.externalId ? String(ref.externalId).slice(0, 128) : null,
      anchorIds:
        anchorMap?.get(ref.marker)?.length > 0
          ? anchorMap.get(ref.marker)
          : null,
    })),
  });
}

/**
 * Format references for API response.
 */
export function formatReferencesForClient(rows) {
  return (rows || []).map((r) => ({
    id: r.id,
    marker: r.marker,
    kind: r.kind,
    title: r.title,
    authors: r.authors,
    year: r.year,
    venue: r.venue,
    doi: r.doi,
    url: r.url,
    abstract: r.abstract,
    provider: r.provider,
    anchorIds: Array.isArray(r.anchorIds) ? r.anchorIds : [],
  }));
}
