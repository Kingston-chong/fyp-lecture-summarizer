"use client";

import { useEffect, useState } from "react";
import { isQuizAcceptingResponses } from "@/lib/quizCollection";

/**
 * Keeps "accepting responses" in sync when closesAt passes (no page refresh).
 */
export function useQuizAcceptingLiveState(initialAccepting, closesAt) {
  const [accepting, setAccepting] = useState(() =>
    isQuizAcceptingResponses({
      acceptingResponses: Boolean(initialAccepting),
      closesAt,
    }),
  );

  useEffect(() => {
    setAccepting(
      isQuizAcceptingResponses({
        acceptingResponses: Boolean(initialAccepting),
        closesAt,
      }),
    );
  }, [initialAccepting, closesAt]);

  useEffect(() => {
    if (!accepting || !closesAt) return undefined;
    const closes = new Date(closesAt);
    if (Number.isNaN(closes.getTime())) return undefined;
    const ms = closes.getTime() - Date.now();
    if (ms <= 0) {
      setAccepting(false);
      return undefined;
    }
    const timer = setTimeout(() => setAccepting(false), ms);
    return () => clearTimeout(timer);
  }, [accepting, closesAt]);

  return accepting;
}
