import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeChatReplyReferences,
  looksLikeLectureSource,
} from "./chatReplyReferences.js";

describe("finalizeChatReplyReferences", () => {
  it("strips References for lecturer when search is off", () => {
    const md =
      "Body text.\n\n## References\n- [1] My Lecture Summary\n- [2] Notes";
    const out = finalizeChatReplyReferences(md, [], {
      wantsReferences: false,
      summarizeRole: "lecturer",
    });
    assert.equal(out, "Body text.");
    assert.doesNotMatch(out, /## References/i);
  });

  it("rebuilds References from web sources when search is on", () => {
    const md = "External claim [1].";
    const sources = [
      {
        marker: 1,
        kind: "paper",
        title: "Attention Is All You Need",
        url: "https://example.org/paper",
      },
    ];
    const out = finalizeChatReplyReferences(md, sources, {
      wantsReferences: true,
      summarizeRole: "lecturer",
      summaryTitle: "CS101",
    });
    assert.match(out, /## References/);
    assert.match(out, /Attention Is All You Need/);
    assert.match(out, /\[1\]/);
  });
});

describe("looksLikeLectureSource", () => {
  it("flags summary title match", () => {
    assert.equal(
      looksLikeLectureSource(
        { kind: "web", title: "CS101 Lecture", url: null },
        "CS101 Lecture",
      ),
      true,
    );
  });
});
