import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeQuizSettings,
  revealsAnswerAfterEachQuestion,
  ANSWER_SHOW_AFTER_ALL,
  ANSWER_SHOW_IMMEDIATELY,
} from "./quizSettings.js";

test("normalizeQuizSettings maps legacy Practice quizMode to showHints", () => {
  const s = normalizeQuizSettings({ quizMode: "Practice" });
  assert.equal(s.showHints, true);
});

test("normalizeQuizSettings maps legacy Assessment quizMode to no hints", () => {
  const s = normalizeQuizSettings({ quizMode: "Assessment" });
  assert.equal(s.showHints, false);
});

test("normalizeQuizSettings prefers explicit showHints over quizMode", () => {
  const s = normalizeQuizSettings({
    quizMode: "Practice",
    showHints: false,
  });
  assert.equal(s.showHints, false);
});

test("revealsAnswerAfterEachQuestion respects answerShowMode", () => {
  assert.equal(
    revealsAnswerAfterEachQuestion({ answerShowMode: ANSWER_SHOW_IMMEDIATELY }),
    true,
  );
  assert.equal(
    revealsAnswerAfterEachQuestion({ answerShowMode: ANSWER_SHOW_AFTER_ALL }),
    false,
  );
});
