import { historyMatchesSearch } from "@/app/components/HistorySummaryExpand";

/** Pinned first, then by pinnedAt / createdAt (newest first). */
export function sortHistoryItems(items) {
  return [...items].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    const at = new Date(a.pinnedAt || a.createdAt).getTime();
    const bt = new Date(b.pinnedAt || b.createdAt).getTime();
    if (at !== bt) return bt - at;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function filterHistoryBySearch(history, search) {
  const q = String(search || "")
    .trim()
    .toLowerCase();
  if (!q) return history;
  return history.filter((h) => historyMatchesSearch(h, q));
}

export function prepareHistoryList(history, search) {
  const filtered = filterHistoryBySearch(history, search);
  return {
    sorted: sortHistoryItems(filtered),
    isEmpty: history.length === 0,
    noMatches: history.length > 0 && filtered.length === 0,
  };
}
