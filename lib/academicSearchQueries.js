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

Rules for "queries" (4 to 6 strings):
- Each query is 1–2 words only — short keywords work best on Semantic Scholar / OpenAlex.
- Pick the lecture's core concepts (e.g. "greenhouse", "greenhouse gases", "carbon cycle", "white-box testing").
- Do NOT use full sentences, 3+ word phrases, or meta text like "find journals", "related to", or file names.
- Prefer distinctive domain terms over generic words (avoid "introduction", "overview", "methods").

Rules for "keyTerms" (8 to 16 strings):
- Short topic labels and important multi-word concepts from the lecture.
- Used to score whether returned papers are on-topic.`;

/**
 * @param {unknown} parsed
 * @returns {{ queries: string[]; keyTerms: string[] }}
 */
/** @param {string} query */
function shortenLlmSearchQuery(query) {
  const words = String(query || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return "";
  return words.slice(0, 2).join(" ").slice(0, 60);
}

export function parseLlmAcademicSearchPayload(parsed) {
  const queries = [];
  const keyTerms = [];

  if (Array.isArray(parsed?.queries)) {
    for (const q of parsed.queries) {
      const s = shortenLlmSearchQuery(q);
      if (s.length >= 3) queries.push(s);
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
