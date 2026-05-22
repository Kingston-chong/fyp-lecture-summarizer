import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampAtPosition,
  insertIndexFromAtPosition,
  normalizeOrderUpdates,
  validateReorderIds,
} from "./flashcardOrder.js";

describe("flashcardOrder", () => {
  it("clampAtPosition", () => {
    assert.equal(clampAtPosition(1, 3), 1);
    assert.equal(clampAtPosition(4, 3), 4);
    assert.equal(clampAtPosition(99, 3), 4);
    assert.equal(clampAtPosition(null, 0), 1);
  });

  it("insertIndexFromAtPosition", () => {
    assert.equal(insertIndexFromAtPosition(1, 2), 0);
    assert.equal(insertIndexFromAtPosition(3, 2), 2);
  });

  it("normalizeOrderUpdates", () => {
    const updates = normalizeOrderUpdates([
      { id: 10, order: 5 },
      { id: 11, order: 0 },
    ]);
    assert.deepEqual(updates, [
      { id: 11, order: 0 },
      { id: 10, order: 1 },
    ]);
  });

  it("validateReorderIds", () => {
    const cards = [{ id: 1 }, { id: 2 }];
    assert.equal(validateReorderIds(cards, [2, 1]), true);
    assert.equal(validateReorderIds(cards, [1]), false);
    assert.equal(validateReorderIds(cards, [1, 3]), false);
  });
});
