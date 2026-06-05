import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeChatReplyReferences,
  looksLikeLectureSource,
  stripNumericCitationMarkers,
  isUsableReferenceSource,
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

  it("builds link-only References from markdown links in body", () => {
    const md =
      "See [White Box Testing Review](https://example.org/paper) for details.";
    const sources = [
      {
        marker: 1,
        kind: "paper",
        title: "White Box Testing Review",
        url: "https://example.org/paper",
        authors: "A. Author",
        year: 2020,
      },
    ];
    const out = finalizeChatReplyReferences(md, sources, {
      wantsReferences: true,
      summarizeRole: "lecturer",
      summaryTitle: "CS101",
      userText: "find articles on white box testing",
    });
    assert.match(out, /## References/);
    assert.match(
      out,
      /\[White Box Testing Review\]\(https:\/\/example\.org\/paper\)/,
    );
    assert.doesNotMatch(out, /\[1\]/);
    assert.doesNotMatch(out, /markers/i);
    assert.doesNotMatch(out, /Regenerate/i);
  });

  it("shows a short not-found line when nothing usable was cited", () => {
    const md = "Try IEEE Xplore and ACM Digital Library.";
    const sources = [
      {
        marker: 1,
        kind: "web",
        title: "[[PDF] broken path 900/1/23PDF.pdf",
        url: "https://example.com/900/1/23PDF.pdf",
      },
    ];
    const out = finalizeChatReplyReferences(md, sources, {
      wantsReferences: true,
      summarizeRole: "lecturer",
      userText: "find articles on white box testing",
    });
    assert.match(out, /No articles with accessible links were found/);
    assert.doesNotMatch(out, /Search found these sources/i);
    assert.doesNotMatch(out, /\[1\]/);
  });
});

describe("stripNumericCitationMarkers", () => {
  it("removes [1] but keeps markdown links", () => {
    const out = stripNumericCitationMarkers(
      "Claim [1] and [Title](https://x.com).",
    );
    assert.doesNotMatch(out, /\[1\]/);
    assert.match(out, /\[Title\]\(https:\/\/x\.com\)/);
  });
});

describe("isUsableReferenceSource", () => {
  it("rejects broken PDF-style web titles", () => {
    assert.equal(
      isUsableReferenceSource(
        {
          kind: "web",
          title: "[[PDF] Doing Case Study Research 900/1/23PDF.pdf",
          url: "https://example.com/doc.pdf",
        },
        "CS101",
      ),
      false,
    );
  });

  it("accepts papers with DOI link", () => {
    assert.equal(
      isUsableReferenceSource(
        {
          kind: "paper",
          title: "White Box Testing Review",
          url: null,
          doi: "10.1000/xyz",
        },
        "CS101",
      ),
      true,
    );
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
