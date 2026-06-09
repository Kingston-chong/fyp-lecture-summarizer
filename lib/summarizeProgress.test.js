import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SUMMARIZE_PHASE, summarizePhaseLabel, describeReferenceSearchProgress } from "./summarizeProgress.js";

describe("summarizePhaseLabel", () => {
  it("maps known phases", () => {
    assert.equal(
      summarizePhaseLabel(SUMMARIZE_PHASE.UPLOAD),
      "Uploading files",
    );
    assert.equal(
      summarizePhaseLabel(SUMMARIZE_PHASE.SEARCHING_REFERENCES),
      "Finding references",
    );
    assert.equal(
      summarizePhaseLabel(SUMMARIZE_PHASE.WRITING_SUMMARY),
      "Generating summary",
    );
  });

  it("uses references copy when forReferences", () => {
    assert.equal(
      summarizePhaseLabel(SUMMARIZE_PHASE.EXTRACTING, { forReferences: true }),
      "Reading lecture files",
    );
  });

  it("describes reference search steps", () => {
    const ready = describeReferenceSearchProgress({
      step: "queries_ready",
      queries: ["software testing", "white box testing"],
    });
    assert.equal(ready.headline, "Search keywords");
    assert.equal(ready.lines.length, 2);

    const searching = describeReferenceSearchProgress({
      step: "searching",
      queries: ["software testing"],
    });
    assert.match(searching.headline, /Searching academic databases/i);
  });

  it("describes model fallback step", () => {
    const fb = describeReferenceSearchProgress({
      step: "model_fallback",
      message: "Gemini limit reached — switching to ChatGPT…",
    });
    assert.equal(fb.headline, "Gemini limit reached — switching to ChatGPT…");
  });
});
