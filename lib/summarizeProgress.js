/** @typedef {'upload' | 'prepare' | 'open' | 'extracting' | 'searching_references' | 'writing_summary'} SummarizePhase */

export const SUMMARIZE_PHASE = {
  UPLOAD: "upload",
  PREPARE: "prepare",
  OPEN: "open",
  EXTRACTING: "extracting",
  SEARCHING_REFERENCES: "searching_references",
  WRITING_SUMMARY: "writing_summary",
};

/**
 * Human-readable label for summarize loading UI (buttons, status line, references panel).
 * @param {SummarizePhase | string | null | undefined} phase
 * @param {{ forReferences?: boolean }} [opts]
 */
export function summarizePhaseLabel(phase, opts = {}) {
  switch (phase) {
    case SUMMARIZE_PHASE.UPLOAD:
      return "Uploading files";
    case SUMMARIZE_PHASE.PREPARE:
      return "Preparing summary";
    case SUMMARIZE_PHASE.OPEN:
      return "Opening summary";
    case SUMMARIZE_PHASE.EXTRACTING:
      return opts.forReferences ? "Reading lecture files" : "Reading documents";
    case SUMMARIZE_PHASE.SEARCHING_REFERENCES:
      return "Finding references";
    case SUMMARIZE_PHASE.WRITING_SUMMARY:
      return opts.forReferences ? "Writing summary" : "Generating summary";
    default:
      return opts.forReferences ? "Loading references" : "Generating summary";
  }
}
