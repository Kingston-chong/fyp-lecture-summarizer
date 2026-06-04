const STORAGE_PREFIX = "s2n-revision-sheet:";

/** Fast stable hash so cache invalidates when summary text changes. */
export function revisionSheetSourceHash(output) {
  const s = String(output || "");
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function cacheKey(summaryId) {
  return `${STORAGE_PREFIX}${summaryId}`;
}

/**
 * @param {string | number} summaryId
 * @param {string} sourceHash from revisionSheetSourceHash(summary.output)
 * @returns {{ markdown: string; title: string; sourceHash: string; cachedAt: string } | null}
 */
export function readRevisionSheetCache(summaryId, sourceHash) {
  if (typeof window === "undefined" || summaryId == null) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(summaryId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.markdown !== "string" || !data.markdown.trim()) {
      return null;
    }
    if (data.sourceHash !== sourceHash) return null;
    return {
      markdown: data.markdown,
      title: String(data.title || "Revision sheet"),
      sourceHash: data.sourceHash,
      cachedAt: data.cachedAt || "",
    };
  } catch {
    return null;
  }
}

/**
 * @param {string | number} summaryId
 * @param {{ markdown: string; title: string; sourceHash: string }} entry
 */
export function writeRevisionSheetCache(summaryId, entry) {
  if (typeof window === "undefined" || summaryId == null) return;
  try {
    window.localStorage.setItem(
      cacheKey(summaryId),
      JSON.stringify({
        markdown: entry.markdown,
        title: entry.title,
        sourceHash: entry.sourceHash,
        cachedAt: new Date().toISOString(),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

/** @param {string | number} summaryId */
export function clearRevisionSheetCache(summaryId) {
  if (typeof window === "undefined" || summaryId == null) return;
  try {
    window.localStorage.removeItem(cacheKey(summaryId));
  } catch {
    /* ignore */
  }
}
