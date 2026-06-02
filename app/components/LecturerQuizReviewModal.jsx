"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { CloseIcon, QuizIco } from "./icons";
import "./LecturerQuizReviewModal.css";
import QuizAttemptDetailModal from "@/app/summary/[id]/components/QuizAttemptDetailModal";
import { formatSlideDeckSavedAt } from "@/app/summary/[id]/helpers";
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

function QuestionCard({ q, idx, mode }) {
  const opts = normalizeOptions(q.options);
  const showKey = mode === "answerKey";

  return (
    <div className="lqr-card">
      <div className="lqr-card-head">
        <span className="lqr-card-q-num">Question {idx + 1}</span>
        <span className="lqr-card-type">{q.type}</span>
      </div>
      <div className="lqr-card-question">{q.question}</div>

      {q.type === "MCQ" && opts.length > 0 && (
        <div className="lqr-options">
          {opts.map((opt, i) => {
            const isCorrect =
              showKey && String(opt).trim() === String(q.answer || "").trim();
            return (
              <div
                key={i}
                className={`lqr-option${isCorrect ? " lqr-option--correct" : ""}`}
              >
                <span
                  className={`lqr-option-letter${isCorrect ? " lqr-option-letter--correct" : ""}`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="lqr-option-text">{opt}</span>
                {isCorrect && (
                  <span className="lqr-option-correct-label">Correct</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {q.type === "True/False" && (
        <div className="lqr-tf-row">
          {["True", "False"].map((opt) => {
            const isCorrect = showKey && opt === q.answer;
            return (
              <span
                key={opt}
                className={`lqr-tf-pill${isCorrect ? " lqr-tf-pill--correct" : ""}`}
              >
                {opt}
                {isCorrect ? " ✓" : ""}
              </span>
            );
          })}
        </div>
      )}

      {(q.type === "FillInBlanks" || q.type === "ShortAnswer") && showKey && (
        <div className="lqr-expected">
          Expected answer:{" "}
          <strong className="qvm-answer--ok">{q.answer}</strong>
        </div>
      )}

      {showKey && q.explanation && (
        <div className="lqr-expl">
          <strong>Explanation: </strong>
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
  const [tab, setTab] = useState("answerKey");
  const [copied, setCopied] = useState("");
  const [published, setPublished] = useState(Boolean(quizSet?.published));
  const [acceptingResponses, setAcceptingResponses] = useState(
    Boolean(quizSet?.acceptingResponses),
  );
  const [shareToken, setShareToken] = useState(quizSet?.shareToken || "");
  const [closesAtLocal, setClosesAtLocal] = useState(() => {
    if (!quizSet?.closesAt) return "";
    const d = new Date(quizSet.closesAt);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
  });
  const [publishLoading, setPublishLoading] = useState(false);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesErr, setResponsesErr] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [attemptQuestions, setAttemptQuestions] = useState([]);
  const [attemptDetail, setAttemptDetail] = useState(null);

  useEffect(() => {
    setPublished(Boolean(quizSet?.published));
    setAcceptingResponses(Boolean(quizSet?.acceptingResponses));
    setShareToken(quizSet?.shareToken || "");
    if (!quizSet?.closesAt) {
      setClosesAtLocal("");
    } else {
      const d = new Date(quizSet.closesAt);
      setClosesAtLocal(
        Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16),
      );
    }
  }, [
    quizSet?.id,
    quizSet?.published,
    quizSet?.acceptingResponses,
    quizSet?.shareToken,
    quizSet?.closesAt,
  ]);

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
      setAcceptingResponses(Boolean(data.acceptingResponses));
      setShareToken(data.shareToken || "");
      onPublishChange?.();
    } catch (e) {
      window.alert(e.message || "Could not update publish status");
    } finally {
      setPublishLoading(false);
    }
  };

  const handleCollectionToggle = async () => {
    if (!summaryId || !quizSet?.id || !published) return;
    setCollectionLoading(true);
    try {
      const res = await fetch(
        `/api/summary/${summaryId}/quiz-sets/${quizSet.id}/collection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acceptingResponses: !acceptingResponses,
            closesAt:
              !acceptingResponses && closesAtLocal
                ? new Date(closesAtLocal).toISOString()
                : null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update collection");
      setAcceptingResponses(Boolean(data.acceptingResponses));
      onPublishChange?.();
    } catch (e) {
      window.alert(e.message || "Could not update collection status");
    } finally {
      setCollectionLoading(false);
    }
  };

  if (!quizSet) return null;

  const listMode = "answerKey";

  const fetchResponses = useCallback(async () => {
    if (!summaryId || !quizSet?.id) return;
    setResponsesLoading(true);
    setResponsesErr("");
    try {
      const res = await fetch(
        `/api/summary/${summaryId}/quiz-sets/${quizSet.id}/attempts`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load responses");
      setAttempts(Array.isArray(data.attempts) ? data.attempts : []);
      setAttemptQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (e) {
      setAttempts([]);
      setAttemptQuestions([]);
      setResponsesErr(e?.message || "Failed to load responses");
    } finally {
      setResponsesLoading(false);
    }
  }, [summaryId, quizSet?.id]);

  useEffect(() => {
    if (tab !== "responses") return;
    void fetchResponses();
  }, [tab, fetchResponses]);

  const openAttemptDetail = useCallback(
    (attempt) => {
      if (!attempt) return;
      const answers =
        attempt.answers && typeof attempt.answers === "object"
          ? attempt.answers
          : {};
      const rows = attemptQuestions.map((q, idx) => {
        const userAnswer = answers[String(idx)] ?? null;
        const correctAnswer = q.answer ?? "";
        return {
          id: q.id ?? `${idx}`,
          questionNumber: idx + 1,
          question: q.question ?? "",
          userAnswer,
          correctAnswer,
          explanation: q.explanation?.trim() || null,
          isCorrect:
            userAnswer != null &&
            String(userAnswer).trim() === String(correctAnswer).trim(),
        };
      });
      setAttemptDetail({
        id: attempt.id,
        createdAt: attempt.createdAt,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        rows,
      });
    },
    [attemptQuestions],
  );

  return (
    <>
      <div
        className="sl-overlay lqr-overlay"
        role="presentation"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="sl-modal sl-modal--wide lqr-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lqr-title"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="sl-head">
          <div>
            <div className="sl-title" id="lqr-title">
              <QuizIco /> {quizSet.title || "Class quiz"}
            </div>
            <div className="lqr-meta">{meta}</div>
          </div>
          <button
            type="button"
            className="sl-close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="lqr-tabs">
          {[
            { id: "answerKey", label: "Answer key" },
            { id: "responses", label: "Responses" },
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

        <div className="sl-body">
          {tab === "share" ? (
            <div className="lqr-share-grid">
              <div className="lqr-share-col">
                <div className="lqr-share-card">
                  <div className="lqr-share-title">Export files</div>
                  <p className="lqr-share-desc">
                    Download a student handout (no answers) or a full answer key
                    with explanations.
                  </p>
                  <div className="lqr-share-actions">
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
                          formatQuizPlainText(quizSet, {
                            variant: "answerKey",
                          }),
                        )
                      }
                    >
                      Answer key .txt
                    </button>
                  </div>
                </div>

                <div className="lqr-share-card">
                  <div className="lqr-share-title">Google Forms</div>
                  <p className="lqr-share-desc">
                    Copy formatted text and paste questions into{" "}
                    <a
                      href="https://forms.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lqr-link"
                    >
                      Google Forms
                    </a>{" "}
                    manually. Correct answers are marked [CORRECT].
                  </p>
                  <button
                    type="button"
                    className="lqr-btn"
                    onClick={() =>
                      void handleCopy(formatQuizGoogleForms(quizSet), "google")
                    }
                  >
                    {copied === "google" ? "Copied!" : "Copy for Google Forms"}
                  </button>
                </div>
              </div>

              <div className="lqr-share-col lqr-share-col--website">
                <div className="lqr-share-card lqr-share-card--website">
                  <div className="lqr-share-title">
                    Students take in website
                  </div>
                  <p className="lqr-share-desc">
                    Publish a share link first, then start collecting when you
                    are ready for students to submit. Stop collecting to close
                    the window while keeping the link available.
                  </p>
                  <div className="lqr-share-actions lqr-share-actions--center">
                    <button
                      type="button"
                      className="lqr-btn"
                      disabled={publishLoading || collectionLoading}
                      onClick={() => void handlePublish()}
                    >
                      {publishLoading
                        ? "Updating…"
                        : published
                          ? "Unpublish"
                          : "Publish for students"}
                    </button>
                    {published && (
                      <>
                        <label className="lqr-closes-at">
                          <span>Close automatically</span>
                          <input
                            type="datetime-local"
                            value={closesAtLocal}
                            onChange={(e) => setClosesAtLocal(e.target.value)}
                            disabled={collectionLoading || publishLoading}
                          />
                        </label>
                        <span
                          className={`lqr-status-badge${acceptingResponses ? " lqr-status-badge--collecting" : ""}`}
                        >
                          {acceptingResponses ? "Collecting" : "Not collecting"}
                        </span>
                        <button
                          type="button"
                          className={
                            acceptingResponses ? "lqr-btn secondary" : "lqr-btn"
                          }
                          disabled={collectionLoading || publishLoading}
                          onClick={() => void handleCollectionToggle()}
                        >
                          {collectionLoading
                            ? "Updating…"
                            : acceptingResponses
                              ? "Stop collecting"
                              : "Start collecting"}
                        </button>
                      </>
                    )}
                  </div>
                  {published && shareUrl && (
                    <div className="lqr-share-url-wrap">
                      <input
                        readOnly
                        value={shareUrl}
                        className="lqr-share-input"
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
            </div>
          ) : tab === "responses" ? (
            <div className="lqr-share-card" style={{ marginBottom: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <div className="lqr-share-title" style={{ marginBottom: 4 }}>
                    Student responses
                  </div>
                  <div className="lqr-share-desc" style={{ marginBottom: 0 }}>
                    {attempts.length === 0
                      ? "No submissions yet."
                      : `${attempts.length} submission(s) found.`}
                  </div>
                </div>
                <button
                  type="button"
                  className="lqr-btn secondary"
                  disabled={responsesLoading}
                  onClick={() => void fetchResponses()}
                >
                  {responsesLoading ? "Loading…" : "Refresh"}
                </button>
              </div>

              {responsesErr ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.10)",
                    color: "#fecaca",
                  }}
                >
                  {responsesErr}
                </div>
              ) : null}

              {responsesLoading && attempts.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 12, padding: "10px 2px" }}>
                  Loading responses…
                </div>
              ) : attempts.length === 0 ? (
                <div style={{ opacity: 0.65, fontSize: 12, padding: "10px 2px" }}>
                  When students finish the quiz (while you’re collecting), their
                  submissions will appear here.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {attempts.map((a) => {
                    const label =
                      a.respondentLabel ||
                      a.user?.username ||
                      a.user?.email ||
                      "Student";
                    const when = a.createdAt ? formatSlideDeckSavedAt(a.createdAt) : "";
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => openAttemptDetail(a)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,.10)",
                          background: "rgba(255,255,255,.04)",
                          color: "inherit",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 12 }}>
                            {label}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>
                            {a.score}/{a.totalQuestions}
                          </div>
                        </div>
                        {when ? (
                          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
                            {when}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            questions.map((q, i) => (
              <QuestionCard key={q.id ?? i} q={q} idx={i} mode={listMode} />
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
      <QuizAttemptDetailModal
        detail={attemptDetail}
        onClose={() => setAttemptDetail(null)}
      />
    </>
  );
}
