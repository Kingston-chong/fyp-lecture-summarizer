"use client";

import { Fragment, useState, useRef, useCallback, useEffect } from "react";
import { formatSlideDeckSavedAt, parseNumericSummaryId, settingsFromQuizSet } from "../helpers";

export function useQuizSets({ summaryId, status, setQuizData, setQuizSettings, setQuizView }) {
  const numericSummaryId = parseNumericSummaryId(summaryId);
  const [quizSets, setQuizSets] = useState([]);
  const [quizSetsLoading, setQuizSetsLoading] = useState(false);
  const [quizSetOpeningId, setQuizSetOpeningId] = useState(null);
  const [quizHistoryOpenId, setQuizHistoryOpenId] = useState(null);
  const [quizHistoryLoading, setQuizHistoryLoading] = useState(false);
  const [quizHistoryList, setQuizHistoryList] = useState([]);
  const [quizHistoryQuestions, setQuizHistoryQuestions] = useState([]);
  const [quizAttemptDetail, setQuizAttemptDetail] = useState(null);
  const quizHistoryFetchTargetRef = useRef(null);

  const fetchQuizSets = useCallback(async () => {
    if (!numericSummaryId) return;
    setQuizSetsLoading(true);
    try {
      const res = await fetch(`/api/summary/${numericSummaryId}/quiz-sets`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.quizSets)) setQuizSets(data.quizSets);
      else setQuizSets([]);
    } catch {
      setQuizSets([]);
    } finally {
      setQuizSetsLoading(false);
    }
  }, [numericSummaryId]);

  useEffect(() => {
    if (status !== "authenticated" || !numericSummaryId) return;
    void fetchQuizSets();
  }, [status, numericSummaryId, fetchQuizSets]);

  const fetchQuizAttemptHistory = useCallback(
    async (setId) => {
      if (!numericSummaryId || !setId) return;
      quizHistoryFetchTargetRef.current = setId;
      setQuizHistoryLoading(true);
      try {
        const res = await fetch(
          `/api/summary/${numericSummaryId}/quiz-sets/${setId}/attempts`,
        );
        const data = await res.json().catch(() => ({}));
        if (quizHistoryFetchTargetRef.current !== setId) return;
        if (res.ok && Array.isArray(data.attempts)) {
          setQuizHistoryList(data.attempts);
          setQuizHistoryQuestions(
            Array.isArray(data.questions) ? data.questions : [],
          );
        } else {
          setQuizHistoryList([]);
          setQuizHistoryQuestions([]);
        }
      } catch {
        if (quizHistoryFetchTargetRef.current === setId) {
          setQuizHistoryList([]);
          setQuizHistoryQuestions([]);
        }
      } finally {
        if (quizHistoryFetchTargetRef.current === setId)
          setQuizHistoryLoading(false);
      }
    },
    [numericSummaryId],
  );

  const toggleQuizHistoryPanel = useCallback(
    (setId) => {
      if (quizHistoryOpenId === setId) {
        setQuizHistoryOpenId(null);
        setQuizAttemptDetail(null);
        return;
      }
      setQuizHistoryOpenId(setId);
      setQuizHistoryList([]);
      setQuizHistoryQuestions([]);
      setQuizAttemptDetail(null);
      void fetchQuizAttemptHistory(setId);
    },
    [quizHistoryOpenId, fetchQuizAttemptHistory],
  );

  const openQuizAttemptDetail = useCallback(
    (attempt) => {
      if (!attempt) return;
      const answers =
        attempt.answers && typeof attempt.answers === "object"
          ? attempt.answers
          : {};
      const rows = quizHistoryQuestions.map((q, idx) => {
        const userAnswer = answers[String(idx)] ?? null;
        const correctAnswer = q.answer ?? "";
        return {
          id: q.id ?? `${idx}`,
          questionNumber: idx + 1,
          question: q.question ?? "",
          userAnswer,
          correctAnswer,
          isCorrect:
            userAnswer != null &&
            String(userAnswer).trim() === String(correctAnswer).trim(),
        };
      });
      setQuizAttemptDetail({
        id: attempt.id,
        createdAt: attempt.createdAt,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        rows,
      });
    },
    [quizHistoryQuestions],
  );

  const openSavedQuizSet = useCallback(
    async (setId) => {
      if (!numericSummaryId || !setId) return;
      setQuizSetOpeningId(setId);
      try {
        const res = await fetch(
          `/api/summary/${numericSummaryId}/quiz-sets/${setId}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.quizSet) {
          console.warn(data?.error || "Failed to load quiz");
          return;
        }
        setQuizData(data.quizSet);
        setQuizSettings(settingsFromQuizSet(data.quizSet));
        setQuizView(true);
      } catch (e) {
        console.warn(e);
      } finally {
        setQuizSetOpeningId(null);
      }
    },
    [numericSummaryId, setQuizData, setQuizSettings, setQuizView],
  );

  return {
    quizSets,
    quizSetsLoading,
    quizSetOpeningId,
    quizHistoryOpenId,
    quizHistoryLoading,
    quizHistoryList,
    quizAttemptDetail,
    setQuizAttemptDetail,
    fetchQuizSets,
    toggleQuizHistoryPanel,
    openQuizAttemptDetail,
    openSavedQuizSet,
  };
}
