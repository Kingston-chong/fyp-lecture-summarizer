import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SUMMARIZE_PHASE, summarizePhaseLabel } from "./summarizeProgress.js";

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
});
