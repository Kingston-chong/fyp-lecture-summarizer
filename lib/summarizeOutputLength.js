/** @typedef {{ id: string, label: string, hint: string, maxTokens: number, studentInstruction: string, lecturerInstruction: string }} SummarizeOutputLengthOption */

/** @type {SummarizeOutputLengthOption[]} */
export const SUMMARIZE_OUTPUT_LENGTHS = [
  {
    id: "short",
    label: "Short",
    hint: "Key points only — best for quick revision",
    maxTokens: 1200,
    studentInstruction:
      "Output length: SHORT — keep the summary compact (roughly 400–800 words). Use at most 4–5 section headings. Prefer tight bullet lists over long paragraphs. Cover only the most exam-relevant ideas; skip minor examples and repeated points. Do not pad or restate the same idea in multiple sections.",
    lecturerInstruction:
      "Output length: SHORT — produce a concise lecture brief (roughly 500–900 words). Prioritize core claims, methods, and takeaways. Use compact bullets; keep citations only for the strongest claims.",
  },
  {
    id: "medium",
    label: "Medium",
    hint: "Balanced detail (default)",
    maxTokens: 2000,
    studentInstruction:
      "Output length: MEDIUM — balanced study notes: clear sections with concise explanations, but avoid unnecessary repetition or padding.",
    lecturerInstruction:
      "Output length: MEDIUM — balanced depth: lecture-ready detail without exhaustive repetition.",
  },
  {
    id: "detailed",
    label: "Detailed",
    hint: "More explanation and examples",
    maxTokens: 4096,
    studentInstruction:
      "Output length: DETAILED — expand important bullets with explanations, examples, and why they matter, while staying organized and student-friendly. You may use more sections when the source material warrants it.",
    lecturerInstruction:
      "Output length: DETAILED — thorough lecture-ready depth: preserve technical nuance, assumptions, limitations, and implications where the sources support them.",
  },
];

export const DEFAULT_SUMMARIZE_OUTPUT_LENGTH = "medium";

/**
 * @param {unknown} id
 * @returns {SummarizeOutputLengthOption}
 */
export function resolveSummarizeOutputLength(id) {
  const key = String(id || DEFAULT_SUMMARIZE_OUTPUT_LENGTH)
    .trim()
    .toLowerCase();
  return (
    SUMMARIZE_OUTPUT_LENGTHS.find((o) => o.id === key) ||
    SUMMARIZE_OUTPUT_LENGTHS.find((o) => o.id === DEFAULT_SUMMARIZE_OUTPUT_LENGTH) ||
    SUMMARIZE_OUTPUT_LENGTHS[1]
  );
}

/**
 * @param {unknown} lengthId
 * @param {boolean} isLecturer
 */
export function summarizeLengthInstruction(lengthId, isLecturer) {
  const opt = resolveSummarizeOutputLength(lengthId);
  return isLecturer ? opt.lecturerInstruction : opt.studentInstruction;
}
