import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatReplyExcerptLabel } from "./chatReplyDisplay.js";

describe("formatReplyExcerptLabel", () => {
  it("collapses whitespace and truncates long excerpts", () => {
    const long = "Assurance Lifecycle Models ".repeat(4).trim();
    const out = formatReplyExcerptLabel(long, 20);
    assert.equal(out.length, 20);
    assert.ok(out.endsWith("…"));
  });

  it("returns Excerpt for empty input", () => {
    assert.equal(formatReplyExcerptLabel(""), "Excerpt");
  });

  it("keeps short labels unchanged", () => {
    assert.equal(
      formatReplyExcerptLabel("Prisma ORM"),
      "Prisma ORM",
    );
  });
});
