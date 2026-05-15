"use client";

import { Fragment } from "react";
import { Spinner } from "@/app/components/icons";
import { formatSlideDeckSavedAt } from "../helpers";

export default function SavedQuizzesPanel({
  quizSets,
  quizSetsLoading,
  quizSetOpeningId,
  quizHistoryOpenId,
  quizHistoryLoading,
  quizHistoryList,
  onRefresh,
  onToggleHistory,
  onOpenSet,
  onOpenAttempt,
  panelClassName = "hl-panel sd-panel sd-panel--sources",
  showHelpText = true,
}) {
  return (
    <div className={panelClassName} aria-label="Saved quizzes">
      <div className="hl-head-row">
        <div className="hl-head">SAVED QUIZZES</div>
        <button
          type="button"
          className="sd-refresh-btn"
          title="Refresh saved quizzes"
          disabled={quizSetsLoading}
          onClick={onRefresh}
        >
          {quizSetsLoading ? <Spinner size={11} /> : "↻"}
        </button>
      </div>
      {showHelpText && (
        <div className="hl-sub" style={{ marginTop: -4, marginBottom: 6 }}>
          Quiz questions stay saved here. When you <strong>finish</strong> a
          quiz, that score is stored; exiting early does not save an attempt.
          Use <strong>History</strong> below to see past scores for each quiz.
        </div>
      )}
      <div className="sd-deck-list">
        {quizSetsLoading && quizSets.length === 0 ? (
          <div className="hl-empty">
            <Spinner size={12} /> Loading…
          </div>
        ) : quizSets.length === 0 ? (
          <div className="hl-empty">
            None yet. Generate a quiz — it saves here automatically.
          </div>
        ) : (
          quizSets.map((q) => (
            <Fragment key={q.id}>
              <div className="sd-deck-row">
                <div className="sd-deck-title" title={q.title}>
                  {q.title}
                </div>
                <div className="sd-deck-meta">
                  {formatSlideDeckSavedAt(q.createdAt)}
                  {typeof q._count?.questions === "number"
                    ? ` · ${q._count.questions} Q`
                    : ""}
                  {q.latestAttempt ? (
                    <>
                      {" "}
                      · Last: {q.latestAttempt.score}/
                      {q.latestAttempt.totalQuestions}
                      {q.latestAttempt.createdAt
                        ? ` (${formatSlideDeckSavedAt(q.latestAttempt.createdAt)})`
                        : ""}
                    </>
                  ) : (
                    " · No attempts yet"
                  )}
                </div>
                <div className="sd-deck-actions">
                  <button
                    type="button"
                    className="sd-deck-btn"
                    title="View past scores for this quiz"
                    onClick={() => onToggleHistory(q.id)}
                  >
                    {quizHistoryOpenId === q.id ? "Hide" : "History"}
                  </button>
                  <button
                    type="button"
                    className="sd-deck-btn"
                    disabled={quizSetOpeningId === q.id}
                    onClick={() => onOpenSet(q.id)}
                  >
                    {quizSetOpeningId === q.id ? "…" : "Open"}
                  </button>
                </div>
              </div>
              {quizHistoryOpenId === q.id && (
                <div
                  className="hl-sub"
                  style={{
                    margin: "0 0 8px",
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.08)",
                    fontSize: 11,
                    lineHeight: 1.45,
                  }}
                >
                  {quizHistoryLoading ? (
                    <>
                      <Spinner size={11} /> Loading…
                    </>
                  ) : quizHistoryList.length === 0 ? (
                    "No finished attempts yet."
                  ) : (
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        listStyle: "disc",
                      }}
                    >
                      {quizHistoryList.map((a) => (
                        <li key={a.id} style={{ marginBottom: 6 }}>
                          <button
                            type="button"
                            style={{
                              border: "1px solid rgba(255,255,255,.12)",
                              background: "rgba(255,255,255,.04)",
                              color: "inherit",
                              borderRadius: 7,
                              padding: "6px 8px",
                              fontSize: 11,
                              width: "100%",
                              textAlign: "left",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                            onClick={() => onOpenAttempt(a)}
                          >
                            {a.score}/{a.totalQuestions}
                            {a.createdAt
                              ? ` — ${formatSlideDeckSavedAt(a.createdAt)}`
                              : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Fragment>
          ))
        )}
      </div>
    </div>
  );
}
