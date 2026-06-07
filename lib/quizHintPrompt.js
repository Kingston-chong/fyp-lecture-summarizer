/** Instructions for LLM-generated clue-style quiz hints (not answer reveals). */
export const QUIZ_HINT_FIELD_DESCRIPTION = `- hint: (string) A short clue that helps the learner think toward the correct answer. It must NOT state the answer, name an option letter, or quote the correct option verbatim. Use indirect descriptions, properties, comparisons, or constraints (e.g. "the fruit is crispy", "the number is less than 5").`;

/**
 * @param {boolean} showHints
 */
export function buildQuizHintPromptSection(showHints) {
  if (!showHints) {
    return "Hints: disabled — omit the hint field or set it to null on every question.";
  }
  return `Hints: enabled — every question must include a helpful clue.
${QUIZ_HINT_FIELD_DESCRIPTION}`;
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeQuizQuestionHint(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  return text || null;
}
