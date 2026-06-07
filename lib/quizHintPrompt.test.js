import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuizHintPromptSection,
  normalizeQuizQuestionHint,
} from "./quizHintPrompt.js";

test("buildQuizHintPromptSection asks for clue-style hints when enabled", () => {
  const section = buildQuizHintPromptSection(true);
  assert.match(section, /enabled/i);
  assert.match(section, /must NOT state the answer/i);
});

test("buildQuizHintPromptSection disables hints when off", () => {
  const section = buildQuizHintPromptSection(false);
  assert.match(section, /disabled/i);
});

test("normalizeQuizQuestionHint trims and nulls empty values", () => {
  assert.equal(normalizeQuizQuestionHint("  crispy fruit  "), "crispy fruit");
  assert.equal(normalizeQuizQuestionHint(""), null);
  assert.equal(normalizeQuizQuestionHint(null), null);
});
