import test from "node:test";
import assert from "node:assert/strict";
import { GUEST_MAX_FILES, parseGuestSummarizeFormData } from "./guestUpload.js";

test("parseGuestSummarizeFormData rejects empty form", async () => {
  const fd = new FormData();
  fd.append("model", "chatgpt");
  await assert.rejects(
    () => parseGuestSummarizeFormData(fd),
    /file/i,
  );
});

test("parseGuestSummarizeFormData parses model and file", async () => {
  const fd = new FormData();
  fd.append("model", "deepseek");
  fd.append("modelVariant", "deepseek-chat");
  fd.append("summarizeFor", "student");
  fd.append("files", new File(["hello world"], "notes.txt", { type: "text/plain" }));
  const parsed = await parseGuestSummarizeFormData(fd);
  assert.equal(parsed.model, "deepseek");
  assert.equal(parsed.documents.length, 1);
  assert.equal(parsed.documents[0].name, "notes.txt");
  assert.equal(parsed.documents[0].type, "TXT");
});

test("parseGuestSummarizeFormData enforces max file count", async () => {
  const fd = new FormData();
  fd.append("model", "chatgpt");
  for (let i = 0; i < GUEST_MAX_FILES + 1; i++) {
    fd.append("files", new File(["x"], `f${i}.txt`, { type: "text/plain" }));
  }
  await assert.rejects(
    () => parseGuestSummarizeFormData(fd),
    /up to/i,
  );
});
