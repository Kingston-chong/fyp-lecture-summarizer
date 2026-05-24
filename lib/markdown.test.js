import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chatMarkdownToHtml } from "./markdown.js";

describe("chatMarkdownToHtml", () => {
  it("preserves inline [2] citation markers", () => {
    const html = chatMarkdownToHtml("Claim from prior work [2] here.");
    assert.match(html, /\[2\]/);
    assert.match(html, /chat-cite-marker/);
    assert.doesNotMatch(html, /<ol[^>]*>[\s\S]*\[1\]/);
  });

  it("uses ol start when list begins at 2", () => {
    const html = chatMarkdownToHtml("2. Second numbered point");
    assert.match(html, /<ol start="2">/);
    assert.match(html, /Second numbered point/);
  });

  it("preserves [1] when text has underscores before the marker", () => {
    const html = chatMarkdownToHtml("in_depth discussion [1].");
    assert.match(html, /chat-cite-marker/);
    assert.match(html, /\[1\]/);
    assert.doesNotMatch(html, /@@CITE/);
  });
});
