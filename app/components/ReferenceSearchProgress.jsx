"use client";

import {
  SUMMARIZE_PHASE,
  describeReferenceSearchProgress,
  normalizeSummarizeStatus,
} from "@/lib/summarizeProgress";
import "./ReferenceSearchProgress.css";

/**
 * Live progress for lecturer-mode academic reference search during summarization.
 * @param {{ status?: import("@/lib/summarizeProgress").SummarizeStatusPayload | string | null; compact?: boolean }}
 */
export default function ReferenceSearchProgress({ status, compact = false }) {
  const normalized = normalizeSummarizeStatus(status);
  if (!normalized) return null;

  const isRefSearch =
    normalized.phase === SUMMARIZE_PHASE.SEARCHING_REFERENCES;
  const isModelFallback = normalized.step === "model_fallback";
  if (!isRefSearch && !isModelFallback) return null;

  const { headline, lines } = describeReferenceSearchProgress(normalized);
  if (!headline && lines.length === 0) return null;

  return (
    <div
      className={`ref-search-progress${compact ? " ref-search-progress--compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="ref-search-progress-head">
        <span className="ref-search-progress-spin" aria-hidden />
        <strong>{headline}</strong>
      </div>
      {lines.length > 0 ? (
        <ul className="ref-search-progress-list">
          {lines.map((line, i) => (
            <li key={`${line}-${i}`}>{line.replace(/^•\s*/, "")}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
