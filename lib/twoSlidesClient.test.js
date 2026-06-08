import test from "node:test";
import assert from "node:assert/strict";
import {
  getTwoSlidesApiKeys,
  shouldTryNextTwoSlidesKey,
} from "./twoSlidesClient.js";

const envBackup = { ...process.env };

test.afterEach(() => {
  process.env = { ...envBackup };
});

test("getTwoSlidesApiKeys reads primary, fallback list, and numbered keys", () => {
  process.env.TWOSLIDES_API_KEY = "key-primary";
  process.env.TWOSLIDES_API_KEY_FALLBACK = "key-backup-1, key-backup-2";
  process.env.TWOSLIDES_API_KEY_3 = "key-third";
  process.env.TWOSLIDES_API_KEY_2 = "key-primary";

  assert.deepEqual(getTwoSlidesApiKeys(), [
    "key-primary",
    "key-backup-1",
    "key-backup-2",
    "key-third",
  ]);
});

test("getTwoSlidesApiKeys ignores placeholders", () => {
  process.env.TWOSLIDES_API_KEY = "your_2slides_api_key";
  process.env.TWOSLIDES_API_KEY_FALLBACK = "real-key";
  assert.deepEqual(getTwoSlidesApiKeys(), ["real-key"]);
});

test("shouldTryNextTwoSlidesKey covers auth, quota, and job lookup", () => {
  assert.equal(shouldTryNextTwoSlidesKey(401, "POST"), true);
  assert.equal(shouldTryNextTwoSlidesKey(402, "POST"), true);
  assert.equal(shouldTryNextTwoSlidesKey(429, "POST"), true);
  assert.equal(shouldTryNextTwoSlidesKey(404, "GET"), true);
  assert.equal(shouldTryNextTwoSlidesKey(400, "POST"), false);
  assert.equal(shouldTryNextTwoSlidesKey(500, "POST"), false);
});
