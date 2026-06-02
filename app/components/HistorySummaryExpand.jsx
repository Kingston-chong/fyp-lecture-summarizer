"use client";

import "./HistorySummaryExpand.css";
import { formatSlideDeckProviderLabel } from "@/app/summary/[id]/helpers";
import { ChevronDownIcon, FileIcon } from "./icons";

export const HISTORY_EXPAND_TABS = ["files", "slideDecks", "quizzes"];

export function historyItemHasDetails(h) {
  return (
    (h.files?.length ?? 0) > 0 ||
    (h.slideDecks?.length ?? 0) > 0 ||
    (h.quizzes?.length ?? 0) > 0
  );
}

export function defaultHistoryExpandTab(h) {
  if ((h.files?.length ?? 0) > 0) return "files";
  if ((h.slideDecks?.length ?? 0) > 0) return "slideDecks";
  if ((h.quizzes?.length ?? 0) > 0) return "quizzes";
  return "files";
}

export function formatHistoryMetaParts(h) {
  const parts = [];
  const fileCount = h.files?.length ?? 0;
  const deckCount = h.slideDecks?.length ?? 0;
  const quizCount = h.quizzes?.length ?? 0;
  if (fileCount > 0) {
    parts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""}`);
  }
  if (deckCount > 0) {
    parts.push(`${deckCount} deck${deckCount !== 1 ? "s" : ""}`);
  }
  if (quizCount > 0) {
    parts.push(`${quizCount} quiz${quizCount !== 1 ? "zes" : ""}`);
  }
  return parts;
}

export function historyMatchesSearch(h, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (String(h.title || "").toLowerCase().includes(needle)) return true;
  if (
    (h.files || []).some((f) =>
      String(f.name || "")
        .toLowerCase()
        .includes(needle),
    )
  ) {
    return true;
  }
  if (
    (h.slideDecks || []).some((d) =>
      String(d.title || "")
        .toLowerCase()
        .includes(needle),
    )
  ) {
    return true;
  }
  if (
    (h.quizzes || []).some((quiz) =>
      String(quiz.title || "")
        .toLowerCase()
        .includes(needle),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Chevron + meta line + expandable tabs (files, slide decks, quizzes) for a history row.
 */
export default function HistorySummaryExpand({
  summary,
  expanded,
  expandTab,
  onToggleExpand,
  onExpandTabChange,
  onNavigate,
  summarizeForLabel,
  timeAgoLabel,
  chevronClassName = "hist-expand-chev",
  metaClassName = "hist-expand-meta",
}) {
  const hasDetails = historyItemHasDetails(summary);
  const tabs = HISTORY_EXPAND_TABS.filter((id) => {
    if (id === "files") return (summary.files?.length ?? 0) > 0;
    if (id === "slideDecks") return (summary.slideDecks?.length ?? 0) > 0;
    if (id === "quizzes") return (summary.quizzes?.length ?? 0) > 0;
    return false;
  });
  const activeTab = tabs.includes(expandTab)
    ? expandTab
    : tabs[0] || "files";

  const tabLabels = {
    files: "Files",
    slideDecks: "Decks",
    quizzes: "Quizzes",
  };

  return (
    <>
      <div className="hist-expand-meta-row">
        {hasDetails && (
          <button
            type="button"
            className={`${chevronClassName}${expanded ? " expanded" : ""}`}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide details" : "Show files, decks, and quizzes"}
            title={expanded ? "Hide details" : "Show files, decks, and quizzes"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            <ChevronDownIcon size={10} />
          </button>
        )}
        <div className={metaClassName}>
          <span className="hist-expand-meta-chips">
            {(summary.files?.length ?? 0) > 0 && (
              <span className="hist-expand-count-chip hist-expand-count-chip--file">
                {summary.files.length} file
                {summary.files.length !== 1 ? "s" : ""}
              </span>
            )}
            {(summary.slideDecks?.length ?? 0) > 0 && (
              <span className="hist-expand-count-chip hist-expand-count-chip--deck">
                {summary.slideDecks.length} deck
                {summary.slideDecks.length !== 1 ? "s" : ""}
              </span>
            )}
            {(summary.quizzes?.length ?? 0) > 0 && (
              <span className="hist-expand-count-chip hist-expand-count-chip--quiz">
                {summary.quizzes.length} quiz
                {summary.quizzes.length !== 1 ? "zes" : ""}
              </span>
            )}
          </span>
          {summarizeForLabel ? (
            <span className="hist-expand-meta-for"> · {summarizeForLabel}</span>
          ) : null}
        </div>
      </div>
      {timeAgoLabel != null && (
        <div className="hist-expand-date">{timeAgoLabel}</div>
      )}
      {expanded && hasDetails && (
        <div className="hist-expand-panel" onClick={(e) => e.stopPropagation()}>
          {tabs.length > 1 && (
            <div className="hist-expand-tabs" role="tablist">
              {tabs.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  className={`hist-expand-tab hist-expand-tab--${id}${activeTab === id ? " active" : ""}`}
                  onClick={() => onExpandTabChange(id)}
                >
                  {tabLabels[id]}
                </button>
              ))}
            </div>
          )}
          <div className="hist-expand-chips">
            {activeTab === "files" &&
              (summary.files || []).map((f) => (
                <button
                  type="button"
                  key={f.id}
                  className="hist-expand-chip hist-expand-chip--file"
                  title={f.name}
                  onClick={() => onNavigate(summary.id, "files")}
                >
                  <span className="hist-expand-chip-ico" aria-hidden>
                    <FileIcon type={f.type} />
                  </span>
                  <span className="hist-expand-chip-label">{f.name}</span>
                </button>
              ))}
            {activeTab === "slideDecks" &&
              (summary.slideDecks || []).map((d) => {
                const providerLabel = formatSlideDeckProviderLabel(d.provider);
                return (
                  <button
                    type="button"
                    key={d.id}
                    className="hist-expand-chip hist-expand-chip--deck"
                    title={
                      providerLabel
                        ? `${d.title} — ${providerLabel}`
                        : d.title
                    }
                    onClick={() => onNavigate(summary.id, "slideDecks")}
                  >
                    <span className="hist-expand-chip-ico" aria-hidden>
                      ▦
                    </span>
                    <span className="hist-expand-chip-text">
                      <span className="hist-expand-chip-label">{d.title}</span>
                      {providerLabel ? (
                        <span className="hist-expand-chip-api">
                          {providerLabel}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            {activeTab === "quizzes" &&
              (summary.quizzes || []).map((q) => (
                <button
                  type="button"
                  key={q.id}
                  className="hist-expand-chip hist-expand-chip--quiz"
                  title={q.title}
                  onClick={() => onNavigate(summary.id, "quizzes")}
                >
                  <span className="hist-expand-chip-ico" aria-hidden>
                    ?
                  </span>
                  <span className="hist-expand-chip-label">{q.title}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
