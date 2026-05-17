import test from "node:test";
import assert from "node:assert/strict";
import { isQuizAcceptingResponses } from "./quizCollection.js";

test("isQuizAcceptingResponses respects manual close", () => {
  assert.equal(isQuizAcceptingResponses({ acceptingResponses: false }), false);
  assert.equal(isQuizAcceptingResponses({ acceptingResponses: true }), true);
});

test("isQuizAcceptingResponses closes after closesAt", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(
    isQuizAcceptingResponses({ acceptingResponses: true, closesAt: past }),
    false,
  );
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(
    isQuizAcceptingResponses({ acceptingResponses: true, closesAt: future }),
    true,
  );
});
