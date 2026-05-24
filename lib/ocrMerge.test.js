import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slideNeedsOcr, mergeOcrIntoSlides } from "./ocrMerge.js";

describe("slideNeedsOcr", () => {
  it("flags empty slide placeholder", () => {
    assert.equal(slideNeedsOcr({ text: "(empty slide)", lines: ["(empty slide)"] }), true);
  });

  it("flags sparse text", () => {
    assert.equal(
      slideNeedsOcr({ text: "Hi", lines: ["Hi"] }),
      true,
    );
  });

  it("skips slides with enough structural text", () => {
    const lines = [
      "Introduction to machine learning fundamentals",
      "Supervised vs unsupervised learning overview",
    ];
    assert.equal(
      slideNeedsOcr({ text: lines.join("\n"), lines }),
      false,
    );
  });
});

describe("mergeOcrIntoSlides", () => {
  it("appends new OCR lines and skips duplicates", () => {
    const slides = [
      {
        index: 1,
        text: "Title",
        lines: ["Title"],
      },
    ];
    const out = mergeOcrIntoSlides(slides, {
      0: "Title\nNew bullet from image\nAnother line",
    });
    assert.equal(out[0].lines.includes("Title"), true);
    assert.equal(out[0].lines.includes("New bullet from image"), true);
    assert.equal(out[0].lines.includes("Another line"), true);
    assert.equal(out[0].lines.filter((l) => l === "Title").length, 1);
  });

  it("returns unchanged slide when OCR is empty", () => {
    const slides = [{ index: 1, text: "A", lines: ["A"] }];
    const out = mergeOcrIntoSlides(slides, { 0: "" });
    assert.deepEqual(out, slides);
  });
});
