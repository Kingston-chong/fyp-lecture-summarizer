import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertFetchableDocumentUrl,
  allowedExtensionFromContentType,
  filenameFromContentDisposition,
} from "./fetchRemoteDocument.js";

describe("assertFetchableDocumentUrl", () => {
  it("accepts https URLs", () => {
    assert.equal(
      assertFetchableDocumentUrl("https://example.com/file.pdf"),
      "https://example.com/file.pdf",
    );
  });

  it("rejects localhost", () => {
    assert.throws(
      () => assertFetchableDocumentUrl("http://localhost/a.pdf"),
      /cannot be fetched/i,
    );
  });

  it("rejects invalid URLs", () => {
    assert.throws(
      () => assertFetchableDocumentUrl("not-a-url"),
      /valid http/i,
    );
  });
});

describe("allowedExtensionFromContentType", () => {
  it("maps application/pdf to pdf", () => {
    assert.equal(
      allowedExtensionFromContentType("application/pdf; charset=binary"),
      "pdf",
    );
  });

  it("ignores unsupported types", () => {
    assert.equal(allowedExtensionFromContentType("text/html"), null);
  });
});

describe("filenameFromContentDisposition", () => {
  it("parses quoted filename", () => {
    assert.equal(
      filenameFromContentDisposition('attachment; filename="notes.pdf"'),
      "notes.pdf",
    );
  });
});
