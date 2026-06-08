/**
 * Shared 2slides API helpers (auth + multi-key fallback).
 * @see https://2slides.com/api
 */

import { logger } from "./logger.js";

const TWOSLIDES_BASE = "https://2slides.com";

const PLACEHOLDER_KEYS = new Set([
  "",
  "your_2slides_api_key",
  "your_key_here",
  "your_secret_key_here",
  "replace_me",
]);

/**
 * All configured 2slides keys in priority order (primary first).
 * @returns {string[]}
 */
export function getTwoSlidesApiKeys() {
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

  addKey(process.env.TWOSLIDES_API_KEY);

  const fallback = process.env.TWOSLIDES_API_KEY_FALLBACK;
  if (fallback) {
    for (const part of String(fallback).split(/[,;\n\r]+/)) {
      addKey(part);
    }
  }

  for (let n = 2; n <= 5; n++) {
    addKey(process.env[`TWOSLIDES_API_KEY_${n}`]);
  }

  return keys;
}

/**
 * @returns {string | null}
 */
export function getTwoSlidesApiKey() {
  return getTwoSlidesApiKeys()[0] ?? null;
}

/**
 * Whether to try the next API key after a failed response.
 * @param {number} status
 * @param {string} method
 */
export function shouldTryNextTwoSlidesKey(status, method) {
  if (status === 401 || status === 402 || status === 403 || status === 429) {
    return true;
  }
  // Jobs live on the account that created them — another key may own this id.
  if (method === "GET" && status === 404) return true;
  return false;
}

/**
 * @param {string} pathOrUrl
 */
function resolveTwoSlidesUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${TWOSLIDES_BASE}${path}`;
}

/**
 * Call the 2slides API, trying fallback keys when the primary key fails.
 *
 * @param {string} pathOrUrl Path under TWOSLIDES_BASE or absolute URL
 * @param {RequestInit} [init]
 * @returns {Promise<{ res: Response, data: unknown, keyIndex: number }>}
 */
export async function twoSlidesFetch(pathOrUrl, init = {}) {
  const keys = getTwoSlidesApiKeys();
  if (!keys.length) {
    throw new Error("TWOSLIDES_API_KEY is not configured on the server.");
  }

  const url = resolveTwoSlidesUrl(pathOrUrl);
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
      if (method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

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
          logger.warn("2slides", "2slides request succeeded with fallback API key", {
            keyIndex: i + 1,
            method,
            path: url.replace(TWOSLIDES_BASE, ""),
          });
        }
        return { res, data, keyIndex: i };
      }

      lastRes = res;
      lastData = data;

      if (i < keys.length - 1 && shouldTryNextTwoSlidesKey(res.status, method)) {
        logger.warn("2slides", "2slides key failed; trying fallback", {
          keyIndex: i + 1,
          status: res.status,
          method,
          path: url.replace(TWOSLIDES_BASE, ""),
        });
        continue;
      }

      return { res, data, keyIndex: i };
    } catch (err) {
      if (i < keys.length - 1) {
        logger.warn("2slides", "2slides network error; trying fallback key", {
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

  throw new Error("2slides request failed.");
}

/**
 * @param {unknown} data
 * @returns {string | null}
 */
export function extractTwoSlidesMessage(data) {
  if (!data || typeof data !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (data);
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
  if (o.data && typeof o.data === "object") {
    const nested = /** @type {Record<string, unknown>} */ (o.data);
    if (typeof nested.error === "string" && nested.error.trim()) {
      return nested.error.trim();
    }
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
  }
  return null;
}

export { TWOSLIDES_BASE };
