/** @typedef {'upload' | 'prepare' | 'open' | 'extracting' | 'searching_references' | 'writing_summary'} SummarizePhase */

/** @typedef {'generating_queries' | 'queries_ready' | 'searching' | 'filtering' | 'complete'} ReferenceSearchStep */

export const SUMMARIZE_PHASE = {
  UPLOAD: "upload",
  PREPARE: "prepare",
  OPEN: "open",
  EXTRACTING: "extracting",
  SEARCHING_REFERENCES: "searching_references",
  WRITING_SUMMARY: "writing_summary",
};

export const REF_SEARCH_STEP = {
  GENERATING_QUERIES: "generating_queries",
  QUERIES_READY: "queries_ready",
  SEARCHING: "searching",
  FILTERING: "filtering",
  COMPLETE: "complete",
};

/**
 * @typedef {{
 *   phase?: string;
 *   step?: ReferenceSearchStep;
 *   queries?: string[];
 *   providers?: string[];
 *   paperCount?: number;
 *   papers?: { title: string; year?: number | null }[];
 * }} SummarizeStatusPayload
 */

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

/**
 * Rich copy for reference-search progress (keywords, database search, results).
 * @param {SummarizeStatusPayload | null | undefined} status
 */
export function describeReferenceSearchProgress(status) {
  if (!status?.step) {
    return {
      headline: "Finding related articles",
      lines: ["Reading your lecture content…"],
    };
  }

  switch (status.step) {
    case REF_SEARCH_STEP.GENERATING_QUERIES:
      return {
        headline: "Finding related articles",
        lines: [
          "Using AI to pick 1–2 word search keywords from your lecture…",
        ],
      };
    case REF_SEARCH_STEP.QUERIES_READY:
      return {
        headline: "Search keywords",
        lines: (status.queries || []).length
          ? (status.queries || []).map((q) => `• ${q}`)
          : ["Preparing database queries…"],
      };
    case REF_SEARCH_STEP.SEARCHING:
      return {
        headline: "Searching academic databases",
        lines: [
          "Semantic Scholar & OpenAlex",
          ...(status.queries || [])
            .slice(0, 5)
            .map((q) => `• ${q}`),
        ],
      };
    case REF_SEARCH_STEP.FILTERING:
      return {
        headline: "Ranking results",
        lines: ["Matching papers to your lecture topics…"],
      };
    case REF_SEARCH_STEP.COMPLETE: {
      const count = status.paperCount ?? 0;
      const paperLines = (status.papers || []).map((p) => {
        const yr = p.year ? ` (${p.year})` : "";
        return `• ${p.title}${yr}`;
      });
      if (count === 0) {
        return {
          headline: "No matching papers found",
          lines: [
            "Continuing with your lecture content only.",
            ...(paperLines.length ? paperLines : []),
          ],
        };
      }
      return {
        headline: `Found ${count} related paper${count === 1 ? "" : "s"}`,
        lines: paperLines.length ? paperLines : [`• ${count} papers selected`],
      };
    }
    case "model_fallback":
      return {
        headline: status.message || "Switching AI model",
        lines: [],
      };
    default:
      return {
        headline: "Finding related articles",
        lines: [],
      };
  }
}

/**
 * @param {SummarizeStatusPayload | string | null | undefined} status
 */
export function normalizeSummarizeStatus(status) {
  if (!status) return null;
  if (typeof status === "string") return { phase: status };
  return status;
}
