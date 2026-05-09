/**
 * Minimal in-memory rate limiter (best-effort).
 * Note: In serverless environments this may reset between invocations.
 */
const buckets = new Map();
const MAX_BUCKETS = 50_000;

function now() {
  return Date.now();
}

export function getClientIp(req) {
  const h = req?.headers;
  const fromHeader =
    h?.get?.("cf-connecting-ip") ||
    h?.get?.("x-real-ip") ||
    (h?.get?.("x-forwarded-for") || "").split(",")[0].trim();

  return fromHeader || "unknown";
}

/**
 * @returns {{ ok: true } | { ok: false, retryAfterSeconds: number }}
 */
export function checkRateLimit({
  key,
  limit,
  windowMs,
}) {
  const t = now();
  const existing = buckets.get(key);

  if (!existing || t >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: t + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - t) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { ok: true };
}

export function pruneRateLimitBuckets() {
  if (buckets.size <= MAX_BUCKETS) return;
  const t = now();
  for (const [k, v] of buckets) {
    if (t >= v.resetAt) buckets.delete(k);
    if (buckets.size <= MAX_BUCKETS) return;
  }
}

