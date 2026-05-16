const buckets = new Map();
const MAX_BUCKETS = 50_000;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function hasRedisConfig() {
  return Boolean(redisUrl && redisToken);
}

function now() {
  return Date.now();
}

export function getClientIp(req) {
  const h = req?.headers;
  const read = (name) => {
    if (!h) return "";
    if (typeof h.get === "function") return h.get(name) || "";
    return h[name] || h[name.toLowerCase()] || "";
  };
  const fromHeader =
    read("cf-connecting-ip") ||
    read("x-real-ip") ||
    String(read("x-forwarded-for") || "")
      .split(",")[0]
      .trim();

  return fromHeader || "unknown";
}

/**
 * @returns {{ ok: true } | { ok: false, retryAfterSeconds: number }}
 */
async function checkRateLimitRedis({ key, limit, windowMs }) {
  const redisKey = `rl:${key}`;
  const payload = [
    ["INCR", redisKey],
    ["PEXPIRE", redisKey, String(windowMs), "NX"],
    ["PTTL", redisKey],
  ];

  const res = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Rate limit store unavailable (${res.status})`);

  const data = await res.json();
  const count = Number(data?.[0]?.result ?? 0);
  const pttl = Number(data?.[2]?.result ?? 0);

  if (count > limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((pttl > 0 ? pttl : windowMs) / 1000),
    );
    return { ok: false, retryAfterSeconds };
  }
  return { ok: true };
}

function checkRateLimitMemory({ key, limit, windowMs }) {
  const t = now();
  const existing = buckets.get(key);

  if (!existing || t >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: t + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - t) / 1000),
    );
    return { ok: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { ok: true };
}

export async function checkRateLimit({ key, limit, windowMs }) {
  if (hasRedisConfig()) {
    try {
      return await checkRateLimitRedis({ key, limit, windowMs });
    } catch (err) {
      console.warn("Rate limiter fallback to memory:", err?.message || err);
    }
  }
  return checkRateLimitMemory({ key, limit, windowMs });
}

export function pruneRateLimitBuckets() {
  if (buckets.size <= MAX_BUCKETS) return;
  const t = now();
  for (const [k, v] of buckets) {
    if (t >= v.resetAt) buckets.delete(k);
    if (buckets.size <= MAX_BUCKETS) return;
  }
}
