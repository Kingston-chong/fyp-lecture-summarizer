import test from "node:test";
import assert from "node:assert/strict";
import { enforceLlmRateLimit } from "./llmRateLimitCore.js";

test("enforceLlmRateLimit allows first request", async () => {
  const key = `test-${Date.now()}-${Math.random()}`;
  const res = await enforceLlmRateLimit("summarize", key);
  assert.equal(res, null);
});
