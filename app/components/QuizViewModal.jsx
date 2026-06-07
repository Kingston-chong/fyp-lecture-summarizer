"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevRight, CheckIcon, CloseIcon, InfoIcon } from "./icons";
import "./QuizViewModal.css";
import { LoadingText } from "@/app/components/LoadingText";
import {
  ANSWER_SHOW_AFTER_ALL,
  revealsAnswerAfterEachQuestion,
} from "@/lib/quizSettings";

function optionLetterClass(isCorrect, isWrong, isSelected) {
  if (isCorrect) return "qvm-option-letter qvm-option-letter--correct";
  if (isWrong) return "qvm-option-letter qvm-option-letter--wrong";
  if (isSelected) return "qvm-option-letter qvm-option-letter--selected";
  return "qvm-option-letter qvm-option-letter--default";
}

function SectionHead({ children }) {
  return <div className="qvm-section-head">{children}</div>;
}

export default function QuizViewModal({
  quizSet,
  settings,
  onClose,
  summaryId,
  shareToken,
  respondentLabel = "",
  onAttemptSaved,
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionReveal, setQuestionReveal] = useState({});
  const [hintShown, setHintShown] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [gradedScore, setGradedScore] = useState(null);
  const initialTimeLeft = useMemo(
    () => (settings?.timeLimit ? settings.timeLimit * 60 : null),
    [settings?.timeLimit],
  );
  const revealAfterEach = useMemo(
    () => revealsAnswerAfterEachQuestion(settings),
    [settings],
  );
  const showHintsEnabled = settings?.showHints === true;
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  const timerRef = useRef(null);
  const userAnswersRef = useRef(userAnswers);
  const onAttemptSavedRef = useRef(onAttemptSaved);
  const attemptPersistedRef = useRef(false);
  userAnswersRef.current = userAnswers;
  onAttemptSavedRef.current = onAttemptSaved;

  const resetSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCurrentIdx(0);
    setUserAnswers({});
    setShowExplanation(false);
    setQuestionReveal({});
    setHintShown({});
    setSubmitLoading(false);
    setIsFinished(false);
    setGradedScore(null);
    setTimeLeft(initialTimeLeft);
    attemptPersistedRef.current = false;
    finishRevealRef.current = false;
  }, [initialTimeLeft]);

  useEffect(() => {
    // Opening a different quiz set should allow one new save at finish.
    attemptPersistedRef.current = false;
  }, [quizSet?.id, summaryId, shareToken]);

  /** Persist finished quiz to server (AbortController avoids double POST under React Strict Mode). */
  useEffect(() => {
    if (!isFinished || !quizSet?.id) return undefined;
    const token = shareToken ? String(shareToken).trim() : "";
    const n = Number.parseInt(String(summaryId ?? ""), 10);
    const useShare = token.length > 0;
    if (!useShare && (!Number.isFinite(n) || n <= 0)) return undefined;
    if (attemptPersistedRef.current) return undefined;

    const qs = quizSet.questions || [];
    const total = qs.length;
    if (total === 0) return undefined;

    const ua = userAnswersRef.current;
    let score = 0;
    qs.forEach((q, idx) => {
      if (ua[idx] === q.answer) score++;
    });
    const answers = {};
    for (let i = 0; i < total; i++) {
      if (ua[i] !== undefined && ua[i] !== "") {
        answers[String(i)] = ua[i];
      }
    }

    const ac = new AbortController();
    attemptPersistedRef.current = true;
    void (async () => {
      try {
        const url = useShare
          ? `/api/quiz/share/${encodeURIComponent(token)}/attempts`
          : `/api/summary/${n}/quiz-sets/${quizSet.id}/attempts`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            score,
            totalQuestions: total,
            answers,
            ...(useShare
              ? {
                  respondentLabel: String(respondentLabel).trim().slice(0, 120),
                }
              : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (useShare && res.status === 403) {
            window.alert(
              data.error || "This quiz is not accepting responses right now.",
            );
          }
          return;
        }
        if (useShare && typeof data.score === "number") {
          setGradedScore(data.score);
        }
        onAttemptSavedRef.current?.();
      } catch (e) {
        attemptPersistedRef.current = false;
        if (e?.name !== "AbortError") {
          console.warn("Quiz attempt save failed:", e);
        }
      }
    })();

    return () => ac.abort();
  }, [isFinished, quizSet, summaryId, shareToken, respondentLabel]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !isFinished) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timeLeft, isFinished]);

  const questions = quizSet?.questions || [];
  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const shareTokenStr = shareToken ? String(shareToken).trim() : "";
  const isSharedQuiz = shareTokenStr.length > 0;
  const finishRevealRef = useRef(false);

  const correctAnswerFor = useCallback(
    (idx) => {
      const q = questions[idx];
      const revealed = questionReveal[idx];
      if (isSharedQuiz && revealed) return revealed.correctAnswer ?? "";
      return q?.answer ?? "";
    },
    [questions, questionReveal, isSharedQuiz],
  );

  const explanationFor = useCallback(
    (idx) => {
      const q = questions[idx];
      const revealed = questionReveal[idx];
      const text =
        isSharedQuiz && revealed ? revealed.explanation : q?.explanation;
      const trimmed = text != null ? String(text).trim() : "";
      return trimmed || null;
    },
    [questions, questionReveal, isSharedQuiz],
  );

  const handleSelectAnswer = (ans) => {
    if (showExplanation) return;
    setUserAnswers((prev) => ({ ...prev, [currentIdx]: ans }));
  };

  const fetchQuestionFeedback = useCallback(
    async (idx, userAnswer) => {
      const res = await fetch(
        `/api/quiz/share/${encodeURIComponent(shareTokenStr)}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionIndex: idx, userAnswer }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not load explanation.");
      }
      return data;
    },
    [shareTokenStr],
  );

  const handleSubmit = async () => {
    if (!userAnswers[currentIdx] || submitLoading) return;
    if (revealAfterEach) {
      if (isSharedQuiz) {
        setSubmitLoading(true);
        try {
          const data = await fetchQuestionFeedback(
            currentIdx,
            userAnswers[currentIdx],
          );
          setQuestionReveal((prev) => ({ ...prev, [currentIdx]: data }));
          setShowExplanation(true);
        } catch (e) {
          window.alert(e.message || "Could not load explanation.");
        } finally {
          setSubmitLoading(false);
        }
      } else {
        setShowExplanation(true);
      }
    } else {
      handleNext();
    }
  };

  const hintFor = useCallback(
    (idx) => {
      const text = questions[idx]?.hint;
      const trimmed = text != null ? String(text).trim() : "";
      return trimmed || null;
    },
    [questions],
  );

  const currentHint = hintFor(currentIdx);

  const handleShowHint = useCallback(() => {
    if (!showHintsEnabled || hintShown[currentIdx] || !currentHint) return;
    setHintShown((prev) => ({ ...prev, [currentIdx]: true }));
  }, [showHintsEnabled, hintShown, currentIdx, currentHint]);

  useEffect(() => {
    if (!isFinished || !isSharedQuiz) return undefined;
    if (settings?.answerShowMode !== ANSWER_SHOW_AFTER_ALL) return undefined;
    if (finishRevealRef.current) return undefined;
    finishRevealRef.current = true;

    let cancelled = false;
    void (async () => {
      const ua = userAnswersRef.current;
      const updates = {};
      for (let idx = 0; idx < questions.length; idx++) {
        if (cancelled) return;
        const ans = ua[idx];
        if (ans === undefined || ans === "") continue;
        try {
          const data = await fetchQuestionFeedback(idx, ans);
          updates[idx] = data;
        } catch {
          /* skip failed reveals */
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setQuestionReveal((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isFinished,
    isSharedQuiz,
    settings?.answerShowMode,
    questions.length,
    fetchQuestionFeedback,
  ]);

  const handleNext = () => {
    setShowExplanation(false);
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getScore = () => {
    if (gradedScore != null) return gradedScore;
    let score = 0;
    questions.forEach((q, idx) => {
      const ua = userAnswers[idx];
      const correct = correctAnswerFor(idx);
      if (
        ua != null &&
        String(ua).trim() !== "" &&
        String(ua).trim() === String(correct).trim()
      ) {
        score++;
      }
    });
    return score;
  };

  const isAnswerCorrect = (idx) => {
    const revealed = questionReveal[idx];
    if (revealed && typeof revealed.isCorrect === "boolean") {
      return revealed.isCorrect;
    }
    const ua = userAnswers[idx];
    const correct = correctAnswerFor(idx);
    return (
      ua != null &&
      String(ua).trim() !== "" &&
      String(ua).trim() === String(correct).trim()
    );
  };

  /** X / Escape: confirm while quiz is active. Backdrop ignores clicks until results. */
  const requestClose = useCallback(() => {
    if (!isFinished) {
      const answered = Object.keys(userAnswers).length;
      const msg =
        answered > 0
          ? "Exit the quiz? Your answers so far will be lost."
          : "Exit the quiz?";
      if (!window.confirm(msg)) return;
    }
    onClose();
  }, [isFinished, userAnswers, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  if (!quizSet) return null;

  return (
    <div
      className="sl-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (!isFinished) return;
        onClose();
      }}
    >
      <div
        className="sl-modal sl-modal--quiz"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sl-head">
          <div className="sl-title" id="quiz-modal-title">
            {isFinished
              ? "Quiz Results"
              : `Question ${currentIdx + 1} of ${totalQuestions}`}
          </div>
          <div className="sl-head-actions">
            {timeLeft !== null && !isFinished && (
              <div
                className={`qvm-timer${timeLeft < 30 ? " qvm-timer--urgent" : ""}`}
              >
                Time: {formatTime(timeLeft)}
              </div>
            )}
            <button
              type="button"
              className="sl-close"
              onClick={requestClose}
              aria-label={isFinished ? "Close" : "Exit quiz"}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        <div className="sl-body">
          {!isFinished ? (
            <div className="qvm-active-wrap">
              <div className="qvm-q-type">{currentQuestion.type}</div>
              <h2 className="qvm-q-text">{currentQuestion.question}</h2>

              {showHintsEnabled && !showExplanation && currentHint && (
                <div className="qvm-hint-row">
                  {!hintShown[currentIdx] ? (
                    <button
                      type="button"
                      className="qvm-hint-btn"
                      onClick={handleShowHint}
                    >
                      Show hint
                    </button>
                  ) : (
                    <p className="qvm-hint-reveal" role="status">
                      <span className="qvm-hint-label">Hint:</span> {currentHint}
                    </p>
                  )}
                </div>
              )}

              <div className="options-container">
                {currentQuestion.type === "MCQ" &&
                  currentQuestion.options?.map((opt, i) => {
                    const isSelected = userAnswers[currentIdx] === opt;
                    const correctAns = correctAnswerFor(currentIdx);
                    const showAnswerFeedback =
                      showExplanation && revealAfterEach;
                    const isCorrect = showAnswerFeedback && opt === correctAns;
                    const isWrong =
                      showAnswerFeedback && isSelected && opt !== correctAns;

                    return (
                      <div
                        key={i}
                        className={`quiz-option ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                        onClick={() => handleSelectAnswer(opt)}
                      >
                        <div
                          className={optionLetterClass(
                            isCorrect,
                            isWrong,
                            isSelected,
                          )}
                        >
                          {String.fromCharCode(65 + i)}
                        </div>
                        {opt}
                      </div>
                    );
                  })}
                {currentQuestion.type === "True/False" &&
                  ["True", "False"].map((opt, i) => {
                    const isSelected = userAnswers[currentIdx] === opt;
                    const correctAns = correctAnswerFor(currentIdx);
                    const showAnswerFeedback =
                      showExplanation && revealAfterEach;
                    const isCorrect = showAnswerFeedback && opt === correctAns;
                    const isWrong =
                      showAnswerFeedback && isSelected && opt !== correctAns;

                    return (
                      <div
                        key={i}
                        className={`quiz-option ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                        onClick={() => handleSelectAnswer(opt)}
                      >
                        {opt}
                      </div>
                    );
                  })}
                {(currentQuestion.type === "FillInBlanks" ||
                  currentQuestion.type === "ShortAnswer") && (
                  <div className="qvm-text-answer-wrap">
                    <input
                      type="text"
                      className="txt-inp qvm-text-input"
                      placeholder="Type your answer here..."
                      value={userAnswers[currentIdx] || ""}
                      onChange={(e) => handleSelectAnswer(e.target.value)}
                      disabled={showExplanation}
                    />
                    {showExplanation && revealAfterEach && (
                      <div className="qvm-correct-hint">
                        Correct Answer: {correctAnswerFor(currentIdx)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showExplanation && revealAfterEach && (
                <div className="expl-box">
                  <div className="qvm-expl-head">
                    <InfoIcon /> Explanation
                  </div>
                  <div className="qvm-expl-body">
                    {explanationFor(currentIdx) ??
                      "No explanation available for this question."}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="qvm-results">
              <div className="qvm-score-pct">
                {Math.round((getScore() / totalQuestions) * 100)}%
              </div>
              <div className="qvm-score-label">
                You scored {getScore()} out of {totalQuestions} questions
              </div>
              <div className="qvm-score-hint">
                This result is saved to your account when you finish. Exiting
                before the end does not save a score. Use{" "}
                <strong>Retake quiz</strong> for another attempt, or open this
                quiz again from Saved quizzes to see your latest score in the
                list.
              </div>

              <div className="qvm-review-list">
                <SectionHead>Review Questions</SectionHead>
                {questions.map((q, idx) => (
                  <div key={idx} className="review-card">
                    <div className="qvm-review-row">
                      <span className="qvm-review-q-label">
                        Question {idx + 1}
                      </span>
                      <span
                        className={`qvm-review-status ${isAnswerCorrect(idx) ? "qvm-review-status--ok" : "qvm-review-status--bad"}`}
                      >
                        {isAnswerCorrect(idx) ? "CORRECT" : "WRONG"}
                      </span>
                    </div>
                    <div className="qvm-review-q-text">{q.question}</div>
                    <div className="qvm-review-answer-line">
                      Your answer:{" "}
                      <span
                        className={
                          isAnswerCorrect(idx)
                            ? "qvm-answer--ok"
                            : "qvm-answer--bad"
                        }
                      >
                        {userAnswers[idx] || "No answer"}
                      </span>
                    </div>
                    {!isAnswerCorrect(idx) && (
                      <div className="qvm-review-correct-line">
                        Correct answer:{" "}
                        <span className="qvm-answer--ok">
                          {correctAnswerFor(idx)}
                        </span>
                      </div>
                    )}
                    {explanationFor(idx) && (
                      <div className="qvm-review-expl">
                        <strong className="qvm-expl-strong">
                          Explanation:{" "}
                        </strong>
                        {explanationFor(idx)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sl-foot">
          {!isFinished ? (
            <>
              <div className="qvm-progress-track">
                <div
                  className="qvm-progress-fill"
                  style={{
                    width: `${((currentIdx + (showExplanation ? 1 : 0)) / totalQuestions) * 100}%`,
                    transition: "width .4s cubic-bezier(.16,1,.3,1)",
                  }}
                />
              </div>
              {showExplanation && revealAfterEach ? (
                <button className="btn-submit" onClick={handleNext}>
                  {currentIdx === totalQuestions - 1
                    ? "Finish Quiz"
                    : "Next Question"}{" "}
                  <ChevRight />
                </button>
              ) : (
                <button
                  className="btn-submit"
                  onClick={handleSubmit}
                  disabled={!userAnswers[currentIdx] || submitLoading}
                >
                  <LoadingText active={submitLoading} idle="Submit Answer">
                    Loading
                  </LoadingText>{" "}
                  <CheckIcon />
                </button>
              )}
            </>
          ) : (
            <div className="qvm-finish-actions">
              <button
                type="button"
                onClick={resetSession}
                className="qvm-retake-btn"
              >
                Retake quiz
              </button>
              <button
                type="button"
                className="btn-submit btn-submit--center"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
