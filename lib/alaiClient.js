/**
 * Shared Alai Slides API helpers (auth + error text + multi-key fallback).
 * @see https://docs.getalai.com/api/introduction
 */

import { logger } from "./logger.js";

const ALAI_BASE = "https://slides-api.getalai.com/api/v1";

const PLACEHOLDER_KEYS = new Set([
  "",
  "your_alai_api_key",
  "your_key_here",
  "your_secret_key_here",
  "replace_me",
]);

/**
 * All configured Alai keys in priority order (primary first).
 * @returns {string[]}
 */
export function getAlaiApiKeys() {
  const keys = [];
  const seen = new Set();

  const addKey = (raw) => {
    const key = String(raw ?? "").trim();
    if (!key) return;
    const lower = key.toLowerCase();
    if (PLACEHOLDER_KEYS.has(lower)) return;
    if (seen.has(lower)) return;
    seen.add(lower);
    keys.push(key);
  };

  addKey(process.env.ALAI_API_KEY);

  const fallback = process.env.ALAI_API_KEY_FALLBACK;
  if (fallback) {
    for (const part of String(fallback).split(/[,;\n\r]+/)) {
      addKey(part);
    }
  }

  for (let n = 2; n <= 5; n++) {
    addKey(process.env[`ALAI_API_KEY_${n}`]);
  }

  return keys;
}

/**
 * @returns {string | null}
 */
export function getAlaiApiKey() {
  return getAlaiApiKeys()[0] ?? null;
}

/**
 * Whether to try the next API key after a failed response.
 * @param {number} status
 * @param {string} method
 */
export function shouldTryNextAlaiKey(status, method) {
  if (status === 401 || status === 402 || status === 403 || status === 429) {
    return true;
  }
  // Generations live on the account that created them — another key may own this id.
  if (method === "GET" && status === 404) return true;
  return false;
}

/**
 * @param {string} pathOrUrl
 */
function resolveAlaiUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${ALAI_BASE}${path}`;
}

/**
 * Call the Alai API, trying fallback keys when the primary key fails.
 *
 * @param {string} pathOrUrl Path under ALAI_BASE or absolute URL
 * @param {RequestInit} [init]
 * @returns {Promise<{ res: Response, data: unknown, keyIndex: number }>}
 */
export async function alaiFetch(pathOrUrl, init = {}) {
  const keys = getAlaiApiKeys();
  if (!keys.length) {
    throw new Error("ALAI_API_KEY is not configured.");
  }

  const url = resolveAlaiUrl(pathOrUrl);
  const method = String(init.method || "GET").toUpperCase();
  const { buildBody, ...fetchInit } = init;
  const getBody = () =>
    typeof buildBody === "function" ? buildBody() : fetchInit.body;

  let lastRes = /** @type {Response | null} */ (null);
  let lastData = /** @type {unknown} */ (null);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const headers = new Headers(fetchInit.headers || {});
      headers.set("Authorization", `Bearer ${key}`);

      const res = await fetch(url, {
        ...fetchInit,
        method,
        headers,
        body: getBody(),
        cache: fetchInit.cache ?? "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (i > 0) {
          logger.warn("alai", "Alai request succeeded with fallback API key", {
            keyIndex: i + 1,
            method,
            path: url.replace(ALAI_BASE, ""),
          });
        }
        return { res, data, keyIndex: i };
      }

      lastRes = res;
      lastData = data;

      if (i < keys.length - 1 && shouldTryNextAlaiKey(res.status, method)) {
        logger.warn("alai", "Alai key failed; trying fallback", {
          keyIndex: i + 1,
          status: res.status,
          method,
          path: url.replace(ALAI_BASE, ""),
        });
        continue;
      }

      return { res, data, keyIndex: i };
    } catch (err) {
      if (i < keys.length - 1) {
        logger.warn("alai", "Alai network error; trying fallback key", {
          keyIndex: i + 1,
          method,
          error: String(err?.message || err),
        });
        continue;
      }
      throw err;
    }
  }

  if (lastRes) {
    return { res: lastRes, data: lastData, keyIndex: keys.length - 1 };
  }

  throw new Error("Alai request failed.");
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

/** @param {number} slideCount */
export function toAlaiSlideRange(slideCount) {
  const n = Number.parseInt(String(slideCount ?? ""), 10);
  if (!n || n < 1) return "auto";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  if (n <= 10) return "6-10";
  if (n <= 15) return "11-15";
  if (n <= 20) return "16-20";
  if (n <= 25) return "21-25";
  return "26-50";
}

/** Alai theme IDs from GET /themes are UUIDs; 2slides IDs use other formats. */
export function isAlaiThemeId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(id || "").trim(),
  );
}

export { ALAI_BASE };
