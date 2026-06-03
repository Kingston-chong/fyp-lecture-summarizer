/** Keeps sidebar history and open summary page title in sync after PATCH /api/summary/:id */

export const SUMMARY_RENAMED_EVENT = "s2n-summary-renamed";

export function dispatchSummaryRenamed(id, title) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SUMMARY_RENAMED_EVENT, {
      detail: { id, title: String(title ?? "").trim() },
    }),
  );
}
