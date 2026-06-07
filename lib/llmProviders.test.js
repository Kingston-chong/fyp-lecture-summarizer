import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  getAvailableLlmProviders,
  getDefaultLlmProvider,
  isLlmProviderAvailable,
} from "./llmProviders.js";

describe("llmProviders", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("enables all providers when OpenRouter is set", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GEMINI_API_KEY;
    assert.equal(isLlmProviderAvailable("chatgpt"), true);
    assert.equal(isLlmProviderAvailable("deepseek"), true);
    assert.equal(isLlmProviderAvailable("gemini"), true);
  });

  it("requires direct keys when OpenRouter is unset", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.GEMINI_API_KEY = "g";
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    assert.deepEqual(getAvailableLlmProviders(), ["gemini"]);
    assert.equal(getDefaultLlmProvider(), "gemini");
    assert.equal(isLlmProviderAvailable("chatgpt"), false);
    assert.equal(isLlmProviderAvailable("deepseek"), false);
  });
});
