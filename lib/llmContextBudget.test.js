import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampMaxTokens,
  isContextLengthExceededError,
  prepareChatContextBudget,
  resolveContextWindow,
  trimSystemPrompt,
} from "./llmContextBudget.js";

describe("resolveContextWindow", () => {
  it("recognizes small-context models", () => {
    assert.equal(resolveContextWindow("chatgpt", "gpt-4"), 8192);
    assert.equal(resolveContextWindow("chatgpt", "gpt-4o"), 128_000);
  });
});

describe("clampMaxTokens", () => {
  it("leaves room for prompt tokens", () => {
    const max = clampMaxTokens(400, 8192, 8192);
    assert.ok(max < 8192);
    assert.ok(max >= 256);
  });
});

describe("prepareChatContextBudget", () => {
  it("caps completion tokens for 8k models", () => {
    const longSummary = "word ".repeat(5000);
    const systemPrompt = `Rules here.\nSummary content:\n${longSummary}`;
    const budget = prepareChatContextBudget(
      "chatgpt",
      "gpt-4",
      systemPrompt,
      [{ role: "user", content: "go" }],
      8192,
    );
    assert.ok(budget.maxTokens < 8192);
    assert.ok(
      estimateTokens(budget.systemPrompt) + 512 <= 8192 ||
        budget.systemPrompt.includes("trimmed"),
    );
  });
});

function estimateTokens(text) {
  return Math.ceil(String(text).length / 3.5);
}

describe("trimSystemPrompt", () => {
  it("shortens the summary body section", () => {
    const body = "climate ".repeat(2000);
    const prompt = `Instructions.\nSummary content:\n${body}`;
    const out = trimSystemPrompt(prompt, 500);
    assert.ok(out.length < prompt.length);
    assert.match(out, /trimmed/i);
  });
});

describe("isContextLengthExceededError", () => {
  it("detects OpenAI context errors", () => {
    assert.equal(
      isContextLengthExceededError({
        code: "context_length_exceeded",
        message: "maximum context length",
      }),
      true,
    );
  });
});
