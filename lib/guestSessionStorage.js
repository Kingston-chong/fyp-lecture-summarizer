export const GUEST_SUMMARY_STORAGE_KEY = "slide2notes_guest_summary_v1";

/**
 * @typedef {{
 *   title: string;
 *   output: string;
 *   summarizeFor: string;
 *   model: string;
 *   fileNames: string[];
 *   savedAt: number;
 * }} GuestSummarySession
 */

/** @returns {GuestSummarySession | null} */
export function loadGuestSummarySession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GUEST_SUMMARY_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.output !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

/** @param {GuestSummarySession} session */
export function saveGuestSummarySession(session) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      GUEST_SUMMARY_STORAGE_KEY,
      JSON.stringify({ ...session, savedAt: Date.now() }),
    );
  } catch {
    /* quota */
  }
}

export function clearGuestSummarySession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(GUEST_SUMMARY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
