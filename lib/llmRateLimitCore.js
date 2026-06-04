import { checkRateLimit, pruneRateLimitBuckets } from "./rateLimit.js";

const HOUR_MS = 60 * 60 * 1000;

const DEFAULT_LIMITS = {
  summarize: { limit: 10, windowMs: HOUR_MS },
  "summarize-guest": { limit: 5, windowMs: HOUR_MS },
  "quiz-generate": { limit: 20, windowMs: HOUR_MS },
  "flashcard-generate": { limit: 20, windowMs: HOUR_MS },
  "generate-slides": { limit: 15, windowMs: HOUR_MS },
};

function parseLimit(envKey, fallback) {
  const n = Number.parseInt(process.env[envKey] || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * @returns {Promise<null | { retryAfterSeconds: number }>}
 */
export async function enforceLlmRateLimit(route, userId) {
  pruneRateLimitBuckets();

  const defaults = DEFAULT_LIMITS[route] || { limit: 10, windowMs: HOUR_MS };
  const envPrefix = route.toUpperCase().replace(/-/g, "_");
  const limit = parseLimit(`${envPrefix}_RATE_LIMIT`, defaults.limit);
  const windowMs = parseLimit(`${envPrefix}_RATE_WINDOW_MS`, defaults.windowMs);

  const rl = await checkRateLimit({
    key: `llm:${route}:${userId}`,
    limit,
    windowMs,
  });

  if (rl.ok) return null;
  return { retryAfterSeconds: rl.retryAfterSeconds };
}
