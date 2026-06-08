import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveSummarizeOutputLength,
  summarizeLengthInstruction,
} from "./summarizeOutputLength.js";

describe("summarizeOutputLength", () => {
  it("defaults unknown ids to medium", () => {
    assert.equal(resolveSummarizeOutputLength("nope").id, "medium");
  });

  it("short student instruction mentions compact output", () => {
    const text = summarizeLengthInstruction("short", false);
    assert.match(text, /SHORT/i);
    assert.match(text, /compact|bullet/i);
  });
});
