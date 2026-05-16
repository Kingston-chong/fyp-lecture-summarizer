"use client";

import { formatSlideDeckSavedAt } from "../helpers";

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(4,6,15,0.72)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="qa-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "90vh",
          background: "var(--sum-card-bg)",
          border: "1px solid var(--sum-card-border)",
          borderRadius: 18,
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: grade.bg,
                  border: `1px solid ${grade.color}44`,
                  borderRadius: 999,
                  padding: "4px 12px 4px 8px",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: grade.color,
                  }}
                >
                  {score}/{totalQ}
                </span>
                <span
                  style={{
                    width: 1,
                    height: 12,
                    background: `${grade.color}44`,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: grade.color,
                    opacity: 0.85,
                  }}
                >
                  {pct}% · {grade.label}
                </span>
              </div>
              {detail.createdAt && (
                <span style={{ fontSize: 12, opacity: 0.38 }}>
                  {formatSlideDeckSavedAt(detail.createdAt)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="qa-close-btn"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 10,
              border: "1px solid var(--sum-card-border)",
              background: "transparent",
              color: "var(--sum-inp-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              lineHeight: 1,
              transition: "background 0.15s",
            }}
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
            style={{
              height: "100%",
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${grade.color}80, ${grade.color})`,
              transition: "width 0.6s cubic-bezier(.22,.68,0,1)",
            }}
          />
        </div>

        <div
          className="qa-scroll"
          style={{
            padding: "14px 16px",
            overflowY: "auto",
            minHeight: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {detail.rows.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                opacity: 0.38,
                fontSize: 13,
              }}
            >
              No question data found for this attempt.
            </div>
          ) : (
            detail.rows.map((row, idx) => (
              <div
                key={row.id}
                className="qa-row-card"
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--sum-card-border)",
                  borderLeft: `3px solid ${row.isCorrect ? "#22c55e" : "#ef4444"}`,
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.02)",
                }}
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
