"use client";

import { formatSlideDeckSavedAt } from "../helpers";
import "./QuizAttemptDetailModal.css";

function gradeForPct(pct) {
  if (pct >= 90)
    return {
      label: "Excellent",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.10)",
    };
  if (pct >= 70)
    return { label: "Good", color: "#3b82f6", bg: "rgba(59,130,246,0.10)" };
  if (pct >= 50)
    return { label: "Fair", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" };
  return { label: "Needs work", color: "#ef4444", bg: "rgba(239,68,68,0.10)" };
}

export default function QuizAttemptDetailModal({ detail, onClose }) {
  if (!detail) return null;

  const totalQ = detail.totalQuestions || detail.rows.length || 1;
  const score = detail.score ?? 0;
  const pct = Math.round((score / totalQ) * 100);
  const grade = gradeForPct(pct);

  return (
    <div
      className="qadm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="qadm-modal qa-modal" onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "18px 20px 16px",
            borderBottom: "1px solid var(--sum-head-border)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                opacity: 0.45,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginBottom: 7,
              }}
            >
              Attempt Review
            </div>
            <div
              className="qadm-score-row"
            >
              <div
                className="qadm-grade-pill" style={{ background: grade.bg, border: `1px solid ${grade.color}44` }}
              >
                <span
                  className="qadm-grade-score" style={{ color: grade.color }}
                >
                  {score}/{totalQ}
                </span>
                <span
                  className="qadm-grade-divider" style={{ background: `${grade.color}44` }}
                />
                <span
                  className="qadm-grade-meta" style={{ color: grade.color }}
                >
                  {pct}% · {grade.label}
                </span>
              </div>
              {detail.createdAt && (
                <span className="qadm-date">
                  {formatSlideDeckSavedAt(detail.createdAt)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            type="button" className="qadm-close qa-close-btn" onClick={onClose} aria-label="Close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          style={{
            height: 3,
            background: "rgba(255,255,255,0.05)",
            flexShrink: 0,
          }}
        >
          <div
            className="qadm-progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${grade.color}80, ${grade.color})` }}
          />
        </div>

        <div
          className="qadm-scroll qa-scroll"
        >
          {detail.rows.length === 0 ? (
            <div
              className="qadm-empty"
            >
              No question data found for this attempt.
            </div>
          ) : (
            detail.rows.map((row, idx) => (
              <div
                key={row.id}
                className={`qadm-row qa-row-card ${row.isCorrect ? "qadm-row--correct" : "qadm-row--wrong"}`}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      opacity: 0.38,
                    }}
                  >
                    Q{row.questionNumber ?? idx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: row.isCorrect ? "#22c55e" : "#ef4444",
                      background: row.isCorrect
                        ? "rgba(34,197,94,0.10)"
                        : "rgba(239,68,68,0.10)",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {row.isCorrect ? "✓ Correct" : "✗ Wrong"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    marginBottom: 10,
                  }}
                >
                  {row.question}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <div
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: row.isCorrect
                        ? "rgba(34,197,94,0.08)"
                        : "rgba(239,68,68,0.08)",
                      border: `1px solid ${row.isCorrect ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)"}`,
                      color: row.isCorrect ? "#22c55e" : "#ef4444",
                    }}
                  >
                    <span
                      style={{
                        opacity: 0.6,
                        color: "inherit",
                        marginRight: 4,
                      }}
                    >
                      Your answer:
                    </span>
                    {row.userAnswer != null && String(row.userAnswer).trim() ? (
                      String(row.userAnswer)
                    ) : (
                      <em style={{ opacity: 0.55 }}>No answer</em>
                    )}
                  </div>
                  {!row.isCorrect && (
                    <div
                      style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.22)",
                        color: "#22c55e",
                      }}
                    >
                      <span
                        style={{
                          opacity: 0.6,
                          color: "inherit",
                          marginRight: 4,
                        }}
                      >
                        Correct:
                      </span>
                      {row.correctAnswer}
                    </div>
                  )}
                </div>
                {row.explanation && (
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 10,
                      lineHeight: 1.55,
                      opacity: 0.75,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.15)",
                    }}
                  >
                    <strong style={{ color: "#818cf8" }}>Explanation: </strong>
                    {row.explanation}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--sum-head-border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="qa-dismiss-btn"
            onClick={onClose}
            style={{
              height: 36,
              padding: "0 20px",
              borderRadius: 10,
              border: "1px solid var(--sum-card-border)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 500,
              transition: "opacity 0.15s",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
