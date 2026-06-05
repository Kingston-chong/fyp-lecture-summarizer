/**
 * LLM-generated academic search queries (replaces naive word-frequency-only queries).
 */

import { parseJsonFromLlm } from "./jsonExtract.js";
import { runChat } from "./llmServer.js";

const LECTURE_EXCERPT_CHARS = Math.min(
  24_000,
  Math.max(
    4000,
    Number.parseInt(process.env.ACADEMIC_SEARCH_LLM_CHARS || "14000", 10),
  ),
);

const SYSTEM_PROMPT = `You help find relevant academic journal articles for a university lecture.
Read the lecture/slide content and output ONLY valid JSON (no markdown fences).

Return:
{
  "queries": ["...", "..."],
  "keyTerms": ["...", "..."]
}

Rules for "queries" (3 to 5 strings):
- Each query is 3–12 words, suitable for Semantic Scholar / OpenAlex paper search.
- Focus on core concepts, methods, and domain vocabulary (e.g. "white box software testing techniques").
- Do NOT include meta phrases like "find journals", "related to", "lecture notes", or file names.
- Prefer established academic phrasing over slide boilerplate.

Rules for "keyTerms" (8 to 16 strings):
- Short topic labels and important multi-word concepts from the lecture.
- Used to score whether returned papers are on-topic.`;

/**
 * @param {unknown} parsed
 * @returns {{ queries: string[]; keyTerms: string[] }}
 */
export function parseLlmAcademicSearchPayload(parsed) {
  const queries = [];
  const keyTerms = [];

  if (Array.isArray(parsed?.queries)) {
    for (const q of parsed.queries) {
      const s = String(q ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 120);
      if (s.length > 4) queries.push(s);
    }
  }

  if (Array.isArray(parsed?.keyTerms)) {
    for (const t of parsed.keyTerms) {
      const s = String(t ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);
      if (s.length >= 2) keyTerms.push(s);
    }
  }

  return {
    queries: queries.slice(0, 5),
    keyTerms: keyTerms.slice(0, 16),
  };
}

/**
 * @param {string} combinedText
 * @param {{ name?: string }[]} documents
 * @param {{ model?: string; modelVariant?: string | null }} [opts]
 * @returns {Promise<{ queries: string[]; keyTerms: string[] }>}
 */
export async function generateAcademicSearchQueriesWithLlm(
  combinedText,
  documents = [],
  { model, modelVariant = null } = {},
) {
  if (process.env.ACADEMIC_SEARCH_LLM_QUERIES === "0") {
    return { queries: [], keyTerms: [] };
  }

  const modelKey = String(model || "gemini").trim() || "gemini";
  const excerpt = String(combinedText || "")
    .trim()
    .slice(0, LECTURE_EXCERPT_CHARS);
  if (excerpt.length < 80) {
    return { queries: [], keyTerms: [] };
  }

  const names = (documents || [])
    .map((d) => String(d?.name || "").replace(/\.[^/.]+$/, ""))
    .filter((n) => n.length > 2);

  const userContent = [
    names.length
      ? `Uploaded file names (context only — do not copy into queries): ${names.join(", ")}`
      : "",
    "",
    "Lecture / slide content:",
    excerpt,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  try {
    const raw = await runChat(
      modelKey,
      modelVariant,
      SYSTEM_PROMPT,
      [{ role: "user", content: userContent }],
      { maxTokens: 600 },
    );
    const parsed = parseJsonFromLlm(raw);
    const out = parseLlmAcademicSearchPayload(parsed);
    if (out.queries.length === 0 && out.keyTerms.length === 0) {
      console.warn("Academic search LLM returned no queries or keyTerms");
    }
    return out;
  } catch (e) {
    console.warn("Academic search LLM query generation failed:", e?.message);
    return { queries: [], keyTerms: [] };
  }
}
