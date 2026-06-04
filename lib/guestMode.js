/** Route segment for ephemeral guest summaries (no DB row). */
export const GUEST_SUMMARY_ROUTE_ID = "guest";

export function isGuestSummaryRouteId(id) {
  return String(id ?? "") === GUEST_SUMMARY_ROUTE_ID;
}
