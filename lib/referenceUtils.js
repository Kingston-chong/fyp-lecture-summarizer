/**
 * Citation parsing and reference persistence for lecturer summaries.
 */

import { buildReferencesSectionFromCatalog } from "@/lib/roleProfiles";
import {
  CITE_MARKER_RE,
  stripReferencesSection,
  extractCitationMarkers,
  filterReferencesToCitedInBody,
  stripCitationMarkersNotInSet,
} from "./referenceCitationCore.js";

export {
  stripReferencesSection,
  extractCitationMarkers,
  filterReferencesToCitedInBody,
  stripCitationMarkersNotInSet,
};

/** Lowercase letter(s) for Wikipedia-style back-links (0 → a, 25 → z, 26 → aa). */
export function citationLetterForIndex(i) {
  if (i < 0) return "";
  if (i < 26) return String.fromCharCode(97 + i);
  return (
    citationLetterForIndex(Math.floor(i / 26) - 1) +
    String.fromCharCode(97 + (i % 26))
  );
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
 * Uploaded lecture files are not citable external references.
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
  const citableCatalog = filterOutUploadReferences(fullCatalog);
  const allowedMarkers = citableCatalog.map((r) => r.marker);
  let body = stripReferencesSection(markdown);
  body = stripCitationMarkersNotInSet(body, allowedMarkers);
  body = body.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").trimEnd();

  const anchorMap = buildMarkerAnchorMap(body);
  const citedForStorage = filterCatalogToCitedOnly(citableCatalog, body);

  if (citedForStorage.length === 0) {
    return {
      markdown: body.trim(),
      citedCatalog: [],
      anchorMap,
    };
  }

  const refLines = buildReferencesSectionFromCatalog(citedForStorage);
  return {
    markdown: `${body.trim()}\n\n## References\n${refLines}`,
    citedCatalog: citedForStorage,
    anchorMap,
  };
}

/**
 * Map markers to cite anchor ids in document order (one id per inline [n]).
 * @param {string} markdown
 * @returns {Map<number, string[]>}
 */
export function buildMarkerAnchorMap(markdown) {
  const map = new Map();
  const body = stripReferencesSection(markdown);
  const blocks = String(body || "").split(/\n\n+/);
  const nextOccurrence = new Map();

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^##\s*references\s*$/i.test(trimmed.split("\n")[0])) break;

    const re = new RegExp(CITE_MARKER_RE.source, "g");
    let m;
    while ((m = re.exec(trimmed))) {
      const n = parseInt(m[1], 10);
      const idx = nextOccurrence.get(n) || 0;
      nextOccurrence.set(n, idx + 1);
      const citeId = `cite-${n}-${idx}`;
      if (!map.has(n)) map.set(n, []);
      map.get(n).push(citeId);
    }
  }
  return map;
}

/**
 * Strip invalid citation markers above maxMarker.
 * @param {string} markdown
 * @param {number} maxMarker
 */
export function clampInvalidCitations(markdown, maxMarker) {
  if (!maxMarker || maxMarker < 1) {
    return stripCitationMarkersNotInSet(markdown, []);
  }
  const allowed = [];
  for (let i = 1; i <= maxMarker; i++) allowed.push(i);
  return stripCitationMarkersNotInSet(markdown, allowed);
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
