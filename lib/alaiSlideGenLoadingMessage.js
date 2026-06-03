/** Staged copy for long Alai slide generation (shown in the generate-slides UI). */

export const ALAI_WAIT_MSG_30 = "Still loading… please wait";
export const ALAI_WAIT_MSG_60 = "Still preparing…";
export const ALAI_WAIT_MSG_90 = "Slide is still generating…";
export const ALAI_WAIT_MSG_5MIN = "Almost there…";

const MS_30 = 30_000;
const MS_60 = 60_000;
const MS_90 = 90_000;
const MS_2MIN = 120_000;
const MS_5MIN = 300_000;
const CYCLE_MS = 90_000;

/**
 * @param {number} elapsedMs
 * @param {string} [apiStatusMessage] — used only before the first 30s milestone
 */
export function getAlaiSlideGenLoadingMessage(elapsedMs, apiStatusMessage = "") {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);

  if (elapsed >= MS_5MIN) return ALAI_WAIT_MSG_5MIN;

  if (elapsed >= MS_2MIN) {
    const inCycle = (elapsed - MS_2MIN) % CYCLE_MS;
    if (inCycle < MS_30) return ALAI_WAIT_MSG_30;
    if (inCycle < MS_60) return ALAI_WAIT_MSG_60;
    return ALAI_WAIT_MSG_90;
  }

  if (elapsed >= MS_90) return ALAI_WAIT_MSG_90;
  if (elapsed >= MS_60) return ALAI_WAIT_MSG_60;
  if (elapsed >= MS_30) return ALAI_WAIT_MSG_30;

  const fallback = String(apiStatusMessage || "").trim();
  return fallback || "Building slides from your summary…";
}
