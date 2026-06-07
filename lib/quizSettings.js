/** Reveal correct answer + explanation after each submitted question. */
export const ANSWER_SHOW_IMMEDIATELY = "Immediately";

/** Reveal correct answers + explanations only on the results screen. */
export const ANSWER_SHOW_AFTER_ALL = "After submission";

/**
 * Normalize persisted quiz settings (supports legacy `quizMode`).
 * @param {unknown} raw
 */
export function normalizeQuizSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};

  let showHints = s.showHints;
  if (typeof showHints !== "boolean") {
    if (s.quizMode === "Practice") showHints = true;
    else if (s.quizMode === "Assessment") showHints = false;
    else showHints = false;
  }

  let answerShowMode = s.answerShowMode;
  if (
    answerShowMode !== ANSWER_SHOW_IMMEDIATELY &&
    answerShowMode !== ANSWER_SHOW_AFTER_ALL
  ) {
    answerShowMode = ANSWER_SHOW_IMMEDIATELY;
  }

  const timeLimit =
    typeof s.timeLimit === "number" && !Number.isNaN(s.timeLimit)
      ? s.timeLimit
      : 0;

  return {
    showHints: Boolean(showHints),
    answerShowMode,
    timeLimit,
  };
}

/** @param {ReturnType<typeof normalizeQuizSettings>} settings */
export function revealsAnswerAfterEachQuestion(settings) {
  return settings?.answerShowMode === ANSWER_SHOW_IMMEDIATELY;
}
