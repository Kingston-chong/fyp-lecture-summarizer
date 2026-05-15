/** Parse route param to a positive integer summary id, or null. */
export function parseNumericSummaryId(summaryId) {
  const n = Number.parseInt(String(summaryId ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}, ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatSlideDeckSavedAt(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// Build QuizViewModal settings from persisted QuizSet.settings.
export function settingsFromQuizSet(quizSet) {
  const s =
    quizSet?.settings && typeof quizSet.settings === "object"
      ? quizSet.settings
      : {};
  return {
    answerShowMode: s.answerShowMode ?? "Immediately",
    quizMode: s.quizMode ?? "Practice",
    timeLimit:
      typeof s.timeLimit === "number" && !Number.isNaN(s.timeLimit)
        ? s.timeLimit
        : 0,
  };
}

// Display label for stored summary model e.g. `gemini:gemini-2.0-flash`.
export function formatSummaryModelLabel(stored) {
  if (!stored) return "—";
  const s = String(stored);
  const i = s.indexOf(":");
  const key = (i === -1 ? s : s.slice(0, i)).toLowerCase();
  const map = { chatgpt: "ChatGPT", deepseek: "DeepSeek", gemini: "Gemini" };
  return map[key] || key;
}

export const HIGHLIGHT_PRESETS = [
  { hex: "#fef08a", label: "Yellow" },
  { hex: "#fca5a5", label: "Red" },
  { hex: "#86efac", label: "Green" },
  { hex: "#93c5fd", label: "Blue" },
  { hex: "#f0abfc", label: "Magenta" },
  { hex: "#fdba74", label: "Orange" },
  { hex: "#67e8f9", label: "Cyan" },
];

export const DEFAULT_HL_HEX = HIGHLIGHT_PRESETS[0].hex;

export function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return `rgba(254, 240, 138, ${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
