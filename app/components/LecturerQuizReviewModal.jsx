"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTheme } from "./ThemeProvider.jsx";
import { CloseIcon, QuizIco } from "./icons";
import {
  formatQuizMarkdown,
  formatQuizPlainText,
  formatQuizGoogleForms,
  downloadTextFile,
  slugifyTitle,
} from "@/lib/exportQuiz";

function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map(String);
  if (options && typeof options === "object") {
    return Object.values(options).map(String);
  }
  return [];
}

function QuestionCard({ q, idx, mode, isDark }) {
  const opts = normalizeOptions(q.options);
  const showKey = mode === "answerKey";

  return (
    <div
      className="lqr-card"
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        border: `1px solid ${isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
        background: isDark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            color: isDark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.4)",
          }}
        >
          Question {idx + 1}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(99,102,241,.15)",
            color: "#a5b4fc",
          }}
        >
          {q.type}
        </span>
      </div>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.5,
          color: isDark ? "#fff" : "#1a1a2e",
          marginBottom: 12,
        }}
      >
        {q.question}
      </div>

      {q.type === "MCQ" && opts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opts.map((opt, i) => {
            const isCorrect =
              showKey &&
              String(opt).trim() === String(q.answer || "").trim();
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${
                    isCorrect
                      ? "rgba(34,197,94,.4)"
                      : isDark
                        ? "rgba(255,255,255,.08)"
                        : "rgba(0,0,0,.08)"
                  }`,
                  background: isCorrect
                    ? "rgba(34,197,94,.12)"
                    : "transparent",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    background: isCorrect
                      ? "#22c55e"
                      : isDark
                        ? "rgba(255,255,255,.1)"
                        : "rgba(0,0,0,.08)",
                    color: isCorrect ? "#fff" : "inherit",
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{opt}</span>
                {isCorrect && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e" }}>
                    Correct
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {q.type === "True/False" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {["True", "False"].map((opt) => {
            const isCorrect = showKey && opt === q.answer;
            return (
              <span
                key={opt}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  border: `1px solid ${
                    isCorrect ? "rgba(34,197,94,.4)" : "rgba(255,255,255,.1)"
                  }`,
                  background: isCorrect
                    ? "rgba(34,197,94,.12)"
                    : "transparent",
                }}
              >
                {opt}
                {isCorrect ? " ✓" : ""}
              </span>
            );
          })}
        </div>
      )}

      {(q.type === "FillInBlanks" || q.type === "ShortAnswer") && showKey && (
        <div
          style={{
            fontSize: 13,
            color: isDark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)",
          }}
        >
          Expected answer:{" "}
          <strong style={{ color: "#22c55e" }}>{q.answer}</strong>
        </div>
      )}

      {showKey && q.explanation && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(99,102,241,.08)",
            border: "1px solid rgba(99,102,241,.2)",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: isDark ? "rgba(255,255,255,.75)" : "rgba(0,0,0,.7)",
          }}
        >
          <strong style={{ color: "#a5b4fc" }}>Explanation: </strong>
          {q.explanation}
        </div>
      )}
    </div>
  );
}

export default function LecturerQuizReviewModal({
  quizSet,
  summaryId,
  onClose,
  onRegenerate,
  onPublishChange,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tab, setTab] = useState("answerKey");
  const [copied, setCopied] = useState("");
  const [published, setPublished] = useState(Boolean(quizSet?.published));
  const [shareToken, setShareToken] = useState(quizSet?.shareToken || "");
  const [publishLoading, setPublishLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const questions = useMemo(
    () =>
      [...(quizSet?.questions || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      ),
    [quizSet?.questions],
  );

  const meta = useMemo(() => {
    const s = quizSet?.settings || {};
    const parts = [`${questions.length} questions`];
    if (s.difficulty) parts.push(s.difficulty);
    if (s.timeLimit > 0) parts.push(`${s.timeLimit} min suggested`);
    return parts.join(" · ");
  }, [quizSet?.settings, questions.length]);

  useEffect(() => {
    if (typeof window === "undefined" || !shareToken) {
      setShareUrl("");
      return;
    }
    setShareUrl(`${window.location.origin}/quiz/share/${shareToken}`);
  }, [shareToken]);

  const slug = slugifyTitle(quizSet?.title);

  const handleCopy = useCallback(async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }, []);

  const handlePublish = async () => {
    if (!summaryId || !quizSet?.id) return;
    setPublishLoading(true);
    try {
      const res = await fetch(
        `/api/summary/${summaryId}/quiz-sets/${quizSet.id}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: !published }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setPublished(Boolean(data.published));
      setShareToken(data.shareToken || "");
      onPublishChange?.();
    } catch (e) {
      window.alert(e.message || "Could not update publish status");
    } finally {
      setPublishLoading(false);
    }
  };

  if (!quizSet) return null;

  const listMode = tab === "answerKey" ? "answerKey" : "student";

  return (
    <div
      className={`sl-overlay${isDark ? "" : " quiz-review-light"}`}
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="sl-modal"
        style={{ maxWidth: 720, maxHeight: "90vh" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lqr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap');
          @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
          @keyframes modalIn { from { opacity:0; transform:scale(.96) translateY(14px); } to { opacity:1; transform:none; } }

          .sl-overlay {
            position: fixed; inset: 0; z-index: 1100;
            background: ${isDark ? "rgba(6,6,14,.72)" : "rgba(0,0,20,.4)"};
            backdrop-filter: blur(6px);
            display: flex; align-items: center; justify-content: center;
            padding: 20px; animation: overlayIn .2s ease;
            font-family: 'Sora', sans-serif;
          }
          .sl-modal {
            width: 100%; max-width: 720px; max-height: 90vh;
            background: ${isDark ? "rgba(17,17,27,.97)" : "rgba(255,255,255,.98)"};
            border: 1px solid ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"};
            border-radius: 18px;
            box-shadow: ${isDark ? "0 32px 80px rgba(0,0,0,.7)" : "0 32px 80px rgba(0,0,0,.3)"};
            display: flex; flex-direction: column;
            animation: modalIn .28s cubic-bezier(.16,1,.3,1);
            overflow: hidden;
          }
          .sl-head {
            display: flex; align-items: flex-start; justify-content: space-between;
            padding: 18px 22px 14px;
            border-bottom: 1px solid ${isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)"};
            flex-shrink: 0;
          }
          .sl-title {
            font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600;
            color: ${isDark ? "#e0e0f4" : "#1a1a2e"};
            display: flex; align-items: center; gap: 8px;
          }
          .sl-close {
            width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
            border: 1px solid ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"};
            background: ${isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"};
            color: ${isDark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)"};
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
          }
          .sl-body {
            overflow-y: auto; flex: 1;
            padding: 16px 22px 20px;
          }
          .sl-body::-webkit-scrollbar { width: 3px; }
          .sl-body::-webkit-scrollbar-thumb {
            background: ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.15)"};
            border-radius: 4px;
          }
          .sl-foot {
            display: flex; align-items: center; justify-content: flex-end; gap: 9px;
            padding: 14px 22px;
            border-top: 1px solid ${isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)"};
            flex-shrink: 0;
          }
          .btn-prev {
            height: 36px; padding: 0 18px; border-radius: 9px;
            border: 1px solid ${isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"};
            background: ${isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"};
            font-family: inherit; font-size: 12.5px; font-weight: 500;
            color: ${isDark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)"};
            cursor: pointer;
          }
          .btn-create {
            height: 36px; padding: 0 20px; border-radius: 9px; border: none;
            background: linear-gradient(135deg,#5258ee,#8b5cf6);
            font-family: inherit; font-size: 12.5px; font-weight: 600;
            color: white; cursor: pointer;
            box-shadow: 0 4px 16px rgba(99,102,241,.35);
          }

          .lqr-tabs { display: flex; gap: 4px; padding: 0 22px 12px; border-bottom: 1px solid ${isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)"}; }
          .lqr-tab { padding: 8px 14px; border-radius: 8px; border: none; background: transparent; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; color: ${isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.45)"}; }
          .lqr-tab.on { background: rgba(99,102,241,.18); color: #a5b4fc; }
          .lqr-share-card { padding: 14px; border-radius: 10px; border: 1px solid ${isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}; margin-bottom: 12px; }
          .lqr-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(99,102,241,.35); background: rgba(99,102,241,.15); color: #c7d2fe; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
          .lqr-btn:hover { background: rgba(99,102,241,.28); }
          .lqr-btn.secondary { border-color: ${isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}; background: transparent; color: inherit; }
        `}</style>

        <div className="sl-head">
          <div>
            <div className="sl-title" id="lqr-title">
              <QuizIco /> {quizSet.title || "Class quiz"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: isDark ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.45)",
                marginTop: 4,
              }}
            >
              {meta}
            </div>
          </div>
          <button type="button" className="sl-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="lqr-tabs">
          {[
            { id: "questions", label: "Questions" },
            { id: "answerKey", label: "Answer key" },
            { id: "share", label: "Share" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`lqr-tab ${tab === t.id ? "on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="sl-body" style={{ flex: 1, overflowY: "auto" }}>
          {tab === "share" ? (
            <div>
              <div className="lqr-share-card">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  Export files
                </div>
                <p
                  style={{
                    fontSize: 11,
                    opacity: 0.55,
                    marginBottom: 10,
                    lineHeight: 1.45,
                  }}
                >
                  Download a student handout (no answers) or a full answer key with
                  explanations.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    className="lqr-btn secondary"
                    onClick={() =>
                      downloadTextFile(
                        `${slug}-student.md`,
                        formatQuizMarkdown(quizSet, { variant: "student" }),
                        "text/markdown;charset=utf-8",
                      )
                    }
                  >
                    Student .md
                  </button>
                  <button
                    type="button"
                    className="lqr-btn secondary"
                    onClick={() =>
                      downloadTextFile(
                        `${slug}-student.txt`,
                        formatQuizPlainText(quizSet, { variant: "student" }),
                      )
                    }
                  >
                    Student .txt
                  </button>
                  <button
                    type="button"
                    className="lqr-btn"
                    onClick={() =>
                      downloadTextFile(
                        `${slug}-answer-key.md`,
                        formatQuizMarkdown(quizSet, { variant: "answerKey" }),
                        "text/markdown;charset=utf-8",
                      )
                    }
                  >
                    Answer key .md
                  </button>
                  <button
                    type="button"
                    className="lqr-btn"
                    onClick={() =>
                      downloadTextFile(
                        `${slug}-answer-key.txt`,
                        formatQuizPlainText(quizSet, { variant: "answerKey" }),
                      )
                    }
                  >
                    Answer key .txt
                  </button>
                </div>
              </div>

              <div className="lqr-share-card">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  Google Forms
                </div>
                <p style={{ fontSize: 11, opacity: 0.55, marginBottom: 10, lineHeight: 1.45 }}>
                  Copy formatted text and paste questions into{" "}
                  <a
                    href="https://forms.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#a5b4fc" }}
                  >
                    Google Forms
                  </a>{" "}
                  manually. Correct answers are marked [CORRECT].
                </p>
                <button
                  type="button"
                  className="lqr-btn"
                  onClick={() =>
                    void handleCopy(
                      formatQuizGoogleForms(quizSet),
                      "google",
                    )
                  }
                >
                  {copied === "google" ? "Copied!" : "Copy for Google Forms"}
                </button>
              </div>

              <div className="lqr-share-card">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                  Students take in app
                </div>
                <p style={{ fontSize: 11, opacity: 0.55, marginBottom: 10, lineHeight: 1.45 }}>
                  Publish a share link so students can take this quiz without seeing
                  your lecture summary or the answer key.
                </p>
                <button
                  type="button"
                  className="lqr-btn"
                  disabled={publishLoading}
                  onClick={() => void handlePublish()}
                >
                  {publishLoading
                    ? "Updating…"
                    : published
                      ? "Unpublish"
                      : "Publish for students"}
                </button>
                {published && shareUrl && (
                  <div style={{ marginTop: 12 }}>
                    <input
                      readOnly
                      value={shareUrl}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)"}`,
                        background: isDark
                          ? "rgba(255,255,255,.04)"
                          : "rgba(0,0,0,.03)",
                        color: "inherit",
                        fontSize: 11,
                        fontFamily: "inherit",
                        marginBottom: 8,
                      }}
                    />
                    <button
                      type="button"
                      className="lqr-btn secondary"
                      onClick={() => void handleCopy(shareUrl, "link")}
                    >
                      {copied === "link" ? "Link copied!" : "Copy share link"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            questions.map((q, i) => (
              <QuestionCard
                key={q.id ?? i}
                q={q}
                idx={i}
                mode={listMode}
                isDark={isDark}
              />
            ))
          )}
        </div>

        <div className="sl-foot">
          {onRegenerate && (
            <button type="button" className="btn-prev" onClick={onRegenerate}>
              Regenerate
            </button>
          )}
          <button type="button" className="btn-create" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
