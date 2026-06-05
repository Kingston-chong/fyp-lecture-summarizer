import test from "node:test";
import assert from "node:assert/strict";
import { getAlaiApiKeys, shouldTryNextAlaiKey } from "./alaiClient.js";

const envBackup = { ...process.env };

test.afterEach(() => {
  process.env = { ...envBackup };
});

test("getAlaiApiKeys reads primary, fallback list, and numbered keys", () => {
  process.env.ALAI_API_KEY = "key-primary";
  process.env.ALAI_API_KEY_FALLBACK = "key-backup-1, key-backup-2";
  process.env.ALAI_API_KEY_3 = "key-third";
  process.env.ALAI_API_KEY_2 = "key-primary";

  assert.deepEqual(getAlaiApiKeys(), [
    "key-primary",
    "key-backup-1",
    "key-backup-2",
    "key-third",
  ]);
});

test("getAlaiApiKeys ignores placeholders", () => {
  process.env.ALAI_API_KEY = "your_alai_api_key";
  process.env.ALAI_API_KEY_FALLBACK = "real-key";
  assert.deepEqual(getAlaiApiKeys(), ["real-key"]);
});

test("shouldTryNextAlaiKey covers auth, quota, and generation lookup", () => {
  assert.equal(shouldTryNextAlaiKey(401, "POST"), true);
  assert.equal(shouldTryNextAlaiKey(402, "POST"), true);
  assert.equal(shouldTryNextAlaiKey(429, "POST"), true);
  assert.equal(shouldTryNextAlaiKey(404, "GET"), true);
  assert.equal(shouldTryNextAlaiKey(400, "POST"), false);
  assert.equal(shouldTryNextAlaiKey(500, "POST"), false);
});
