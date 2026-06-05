import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  domainFromSourceUrl,
  sanitizeWebSourceFileName,
} from "./webSourceUtils.js";
import { isDirectFileUrl } from "./webPageExtract.js";

describe("sanitizeWebSourceFileName", () => {
  it("adds .txt extension", () => {
    assert.equal(sanitizeWebSourceFileName("Lecture notes"), "Lecture notes.txt");
  });

  it("strips unsafe characters", () => {
    assert.equal(sanitizeWebSourceFileName('Bad<>name'), "Bad name.txt");
  });
});

describe("domainFromSourceUrl", () => {
  it("returns hostname without www", () => {
    assert.equal(
      domainFromSourceUrl("https://www.example.com/page"),
      "example.com",
    );
  });
});

describe("isDirectFileUrl", () => {
  it("detects pdf links", () => {
    assert.equal(
      isDirectFileUrl("https://example.com/files/notes.pdf"),
      true,
    );
  });

  it("returns false for plain pages", () => {
    assert.equal(isDirectFileUrl("https://example.com/blog/post"), false);
  });
});
