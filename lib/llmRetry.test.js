import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isRetriableLlmError,
  buildProviderFallbackChain,
} from "./llmRetry.js";

describe("isRetriableLlmError", () => {
  it("detects rate limits and quota errors", () => {
    assert.equal(isRetriableLlmError({ status: 429 }), true);
    assert.equal(isRetriableLlmError(new Error("Rate limit exceeded")), true);
    assert.equal(
      isRetriableLlmError(new Error("RESOURCE_EXHAUSTED")),
      true,
    );
    assert.equal(
      isRetriableLlmError(new Error("You exceeded your daily quota")),
      true,
    );
  });

  it("does not retry auth failures", () => {
    assert.equal(isRetriableLlmError({ status: 401 }), false);
    assert.equal(isRetriableLlmError({ status: 403 }), false);
  });
});

describe("buildProviderFallbackChain", () => {
  it("orders fallbacks after primary", () => {
    const chain = buildProviderFallbackChain("gemini", () => [
      "chatgpt",
      "gemini",
      "deepseek",
    ]);
    assert.deepEqual(chain, ["gemini", "chatgpt", "deepseek"]);
  });

  it("skips unavailable providers", () => {
    const chain = buildProviderFallbackChain("gemini", () => ["gemini"]);
    assert.deepEqual(chain, ["gemini"]);
  });
});
