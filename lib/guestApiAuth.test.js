import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("guest summarize route does not use prisma or session auth", () => {
  const guestPath = path.join(
    process.cwd(),
    "app",
    "api",
    "summarize",
    "guest",
    "route.js",
  );
  const src = fs.readFileSync(guestPath, "utf8");
  assert.doesNotMatch(src, /prisma/);
  assert.doesNotMatch(src, /getRequestUser/);
});

test("persist routes still require getRequestUser", () => {
  const apiDir = path.join(process.cwd(), "app", "api");
  const mustAuth = [
    "summarize/route.js",
    "upload/client/route.js",
    "quiz/generate/route.js",
    "history/route.js",
  ];
  for (const rel of mustAuth) {
    const src = fs.readFileSync(path.join(apiDir, rel), "utf8");
    assert.match(src, /getRequestUser\(\)/, `${rel} should require auth`);
  }
});

test("summarize-guest rate limit is configured", async () => {
  const { enforceLlmRateLimit } = await import("./llmRateLimitCore.js");
  const key = `guest-test-${Date.now()}-${Math.random()}`;
  const res = await enforceLlmRateLimit("summarize-guest", `ip:${key}`);
  assert.equal(res, null);
});
