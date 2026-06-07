import test from "node:test";
import assert from "node:assert/strict";
import { shouldUseTextDocumentPreview } from "./documentPreviewClient.js";

test("shouldUseTextDocumentPreview uses file extension, not sourceUrl", () => {
  assert.equal(
    shouldUseTextDocumentPreview({
      name: "lecture.pdf",
      sourceUrl: "https://example.com/paper",
    }),
    false,
  );
  assert.equal(
    shouldUseTextDocumentPreview({
      name: "notes.txt",
      sourceUrl: "https://example.com/page",
    }),
    true,
  );
  assert.equal(
    shouldUseTextDocumentPreview({
      name: "notes.md",
    }),
    true,
  );
});
