/** @typedef {{ id: string, label: string, maxTokens: number, instruction: string }} ChatResponseLengthOption */

/** @type {ChatResponseLengthOption[]} */
export const CHAT_RESPONSE_LENGTHS = [
  {
    id: "quick",
    label: "Quick",
    maxTokens: 180,
    instruction:
      "Response length: QUICK (strict) — entire reply must be 1–2 short sentences (max 3 only if the user asked multiple distinct questions). One paragraph only. No headings, bullet lists, numbered lists, or multi-paragraph essays. Give the direct answer first; skip background and repetition.",
  },
  {
    id: "short",
    label: "Short",
    maxTokens: 1024,
    instruction:
      "Response length: keep replies brief and focused (about 1–3 short paragraphs unless the user explicitly asks for more detail).",
  },
  {
    id: "medium",
    label: "Medium",
    maxTokens: 4096,
    instruction:
      "Response length: balanced — clear and complete without unnecessary padding.",
  },
  {
    id: "long",
    label: "Long",
    maxTokens: 8192,
    instruction:
      "Response length: thorough and detailed when helpful; use headings and bullet lists for longer explanations.",
  },
];

const DEFAULT_ID = "medium";

/**
 * @param {unknown} id
 * @returns {ChatResponseLengthOption}
 */
export function resolveChatResponseLength(id) {
  const key = String(id || DEFAULT_ID)
    .trim()
    .toLowerCase();
  return (
    CHAT_RESPONSE_LENGTHS.find((o) => o.id === key) ||
    CHAT_RESPONSE_LENGTHS.find((o) => o.id === DEFAULT_ID) ||
    CHAT_RESPONSE_LENGTHS[1]
  );
}
