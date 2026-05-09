const DEFAULT_ROLE = "student";
const ALLOWED_SUMMARIZE_ROLES = new Set(["student", "lecturer"]);

export function normalizeSummarizeRole(role) {
  const normalized = String(role || "").toLowerCase().trim();
  if (ALLOWED_SUMMARIZE_ROLES.has(normalized)) return normalized;
  return DEFAULT_ROLE;
}

const ROLE_PROFILES = {
  student: {
    label: "student",
    summaryInstructions: [
      "Write in student-friendly language with clear section headings.",
      "When slides only mention a point briefly, expand it with concise explanations, examples, and why it matters.",
      "Clearly separate what the lecture/material explicitly states from added explanatory context.",
      "Prioritize understanding and clarity over jargon and exhaustive detail.",
    ],
    chatInstructions: [
      "Default to plain language and teaching-oriented explanations.",
      "If the summary is thin, expand with grounded context from attached sources or web excerpts when available.",
      "When adding context not directly in the summary, label it as expanded context.",
    ],
    slideInstructions: [
      "Use simpler bullets with concept scaffolding and short clarifying notes.",
      "Prioritize readability and learning flow over dense technical detail.",
    ],
  },
  lecturer: {
    label: "lecturer",
    summaryInstructions: [
      "Produce a deeper, lecture-ready summary with stronger technical depth and complete context.",
      "Preserve key methods, assumptions, limitations, and implications where available.",
      "When expanding beyond sparse bullets, keep claims source-aware and avoid speculative statements.",
    ],
    chatInstructions: [
      "Provide lecturer-grade answers with precise terminology and concise justifications.",
      "For non-trivial factual claims, use inline numeric citation markers like [1], [2].",
      "Always end with a 'References' section listing each cited source with title and URL/domain.",
      "If evidence is insufficient, explicitly mark uncertainty instead of inventing citations.",
    ],
    slideInstructions: [
      "Use tighter, evidence-oriented claims and lecturer-level phrasing.",
      "Include source attributions in speaker notes or a references-oriented closing slide.",
    ],
  },
};

export function getRoleProfile(role) {
  const normalized = normalizeSummarizeRole(role);
  return ROLE_PROFILES[normalized];
}
