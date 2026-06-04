"use client";

import { formatSlideDeckProviderLabel } from "@/app/summary/[id]/helpers";
import { FileIcon } from "./icons";

/**
 * Canva-style summary details: title, tags, and linked files / decks / quizzes.
 */
export default function HistorySummaryDetailsContent({
  summary,
  summarizeForLabel,
  timeAgoLabel,
  onNavigate,
  variant = "popover",
}) {
  const files = summary.files || [];
  const slideDecks = summary.slideDecks || [];
  const quizzes = summary.quizzes || [];
  const hasAssets =
    files.length > 0 || slideDecks.length > 0 || quizzes.length > 0;
  const isPreview = variant === "preview";

  return (
    <div
      className={`hist-details-card${variant === "menu" ? " hist-details-card--menu" : ""}${isPreview ? " hist-details-card--preview" : ""}`}
    >
      <div className="hist-details-head">
        <div className="hist-details-title" title={summary.title}>
          {summary.title || "Untitled"}
        </div>
        {timeAgoLabel ? (
          <div className="hist-details-sub">{timeAgoLabel}</div>
        ) : null}
      </div>

      <div className="hist-details-tags">
        {summarizeForLabel ? (
          <span className="hist-expand-role-chip">{summarizeForLabel}</span>
        ) : null}
        {files.length > 0 && (
          <span className="hist-expand-count-chip hist-expand-count-chip--file">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        )}
        {slideDecks.length > 0 && (
          <span className="hist-expand-count-chip hist-expand-count-chip--deck">
            {slideDecks.length} deck{slideDecks.length !== 1 ? "s" : ""}
          </span>
        )}
        {quizzes.length > 0 && (
          <span className="hist-expand-count-chip hist-expand-count-chip--quiz">
            {quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""}
          </span>
        )}
      </div>

      {hasAssets && !isPreview ? <div className="hist-details-divider" /> : null}

      {!isPreview && files.length > 0 && (
        <section className="hist-details-section">
          <div className="hist-details-sec-label">Files</div>
          <ul className="hist-details-list">
            {files.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="hist-details-row hist-details-row--file"
                  title={f.name}
                  onClick={() => onNavigate(summary.id, "files")}
                >
                  <span className="hist-details-row-ico" aria-hidden>
                    <FileIcon type={f.type} />
                  </span>
                  <span className="hist-details-row-label">{f.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isPreview && slideDecks.length > 0 && (
        <section className="hist-details-section">
          <div className="hist-details-sec-label">Slide decks</div>
          <ul className="hist-details-list">
            {slideDecks.map((d) => {
              const providerLabel = formatSlideDeckProviderLabel(d.provider);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className="hist-details-row hist-details-row--deck"
                    title={
                      providerLabel
                        ? `${d.title} — ${providerLabel}`
                        : d.title
                    }
                    onClick={() => onNavigate(summary.id, "slideDecks")}
                  >
                    <span className="hist-details-row-ico" aria-hidden>
                      ▦
                    </span>
                    <span className="hist-details-row-text">
                      <span className="hist-details-row-label">{d.title}</span>
                      {providerLabel ? (
                        <span className="hist-details-row-meta">
                          {providerLabel}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!isPreview && quizzes.length > 0 && (
        <section className="hist-details-section">
          <div className="hist-details-sec-label">Quizzes</div>
          <ul className="hist-details-list">
            {quizzes.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  className="hist-details-row hist-details-row--quiz"
                  title={q.title}
                  onClick={() => onNavigate(summary.id, "quizzes")}
                >
                  <span className="hist-details-row-ico" aria-hidden>
                    ?
                  </span>
                  <span className="hist-details-row-label">{q.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isPreview ? (
        <button
          type="button"
          className="hist-details-cta"
          onClick={() => onNavigate(summary.id)}
        >
          Open summary
        </button>
      ) : null}
    </div>
  );
}
