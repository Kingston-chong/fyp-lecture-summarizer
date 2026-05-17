/**
 * Shared Alai Slides API helpers (auth + error text).
 * @see https://docs.getalai.com/api/introduction
 */

const ALAI_BASE = "https://slides-api.getalai.com/api/v1";

const PLACEHOLDER_KEYS = new Set([
  "",
  "your_alai_api_key",
  "your_key_here",
  "your_secret_key_here",
  "replace_me",
]);

/**
 * @returns {string | null}
 */
export function getAlaiApiKey() {
  const raw = process.env.ALAI_API_KEY;
  if (raw == null) return null;
  const key = String(raw).trim();
  if (PLACEHOLDER_KEYS.has(key.toLowerCase())) return null;
  return key || null;
}

/**
 * @param {unknown} data
 * @returns {string | null}
 */
function extractAlaiMessage(data) {
  if (!data || typeof data !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (data);
  if (typeof o.message === "string" && o.message.trim())
    return o.message.trim();
  if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
  if (Array.isArray(o.detail)) {
    const parts = o.detail
      .map((d) =>
        d && typeof d === "object" && typeof d.msg === "string" ? d.msg : null,
      )
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  if (typeof o.detail === "string" && o.detail.trim()) return o.detail.trim();
  return null;
}

/**
 * User-facing message for a failed Alai HTTP response.
 * @param {number} status
 * @param {unknown} data
 */
export function formatAlaiHttpError(status, data) {
  const detail = extractAlaiMessage(data);
  switch (status) {
    case 401:
      return (
        detail ||
        "Alai API key is invalid or missing. Set a valid ALAI_API_KEY in .env.local (create one at app.getalai.com → API)."
      );
    case 402:
      return (
        detail ||
        "Your Alai account has insufficient credits. Add credits in Alai account settings, or try the 2slides provider."
      );
    case 403:
      return (
        detail ||
        "Alai refused this request (forbidden). Check that ALAI_API_KEY is valid, API access is enabled on your account, and you have credits."
      );
    case 429:
      return (
        detail ||
        "Alai rate limit reached (max 5 concurrent generations). Wait a few minutes and try again."
      );
    default:
      return detail || `Alai request failed (HTTP ${status}).`;
  }
}

/**
 * @param {Response} res
 * @param {unknown} data
 * @returns {{ message: string, httpStatus: number }}
 */
export function alaiErrorPayload(res, data) {
  const status = res.status;
  const message = formatAlaiHttpError(status, data);
  // Return 502 for upstream failures so clients show our message, not bare "Forbidden"
  const httpStatus =
    status === 401 || status === 402 || status === 403 || status === 429
      ? 502
      : status >= 400 && status < 600
        ? status
        : 502;
  return { message, httpStatus };
}

/**
 * Optional: verify key with GET /ping (sync).
 * @param {string} apiKey
 */
export async function pingAlaiApiKey(apiKey) {
  const res = await fetch(`${ALAI_BASE}/ping`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export { ALAI_BASE };
