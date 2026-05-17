import { NextResponse } from "next/server";
import { enforceLlmRateLimit as enforceCore } from "./llmRateLimitCore";

export { enforceLlmRateLimit } from "./llmRateLimitCore";

/** Run rate limit check; returns a 429 response or null if allowed. */
export async function applyLlmRateLimit(route, userId) {
  const limited = await enforceCore(route, userId);
  if (!limited) return null;
  return NextResponse.json(
    {
      error: "Too many requests. Please wait before trying again.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSeconds) },
    },
  );
}
