import { buildReferencesSectionMarkdown } from "@/lib/referenceDisplay";

const DEFAULT_ROLE = "student";

const ALLOWED_SUMMARIZE_ROLES = new Set(["student", "lecturer"]);

export function normalizeSummarizeRole(role) {
  const normalized = String(role || "")
    .toLowerCase()
    .trim();

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

      "Do not use inline citation markers or a References/Bibliography section.",

      "Keep the tone approachable and study-oriented rather than academic-paper style.",
    ],

    chatInstructions: [
      "Default to plain language and teaching-oriented explanations.",

      "If the summary is thin, expand with grounded context from attached sources or web excerpts when available.",

      "When adding context not directly in the summary, label it as expanded context.",

      "When the user asks for references, sources, links, or citations, use the numbered source list and end with a References section (URLs as markdown links when available).",
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

      "Use inline numeric citation markers like [1], [2] for substantive claims drawn from the numbered source list.",

      "Markers [1] through [k] refer to uploaded lecture files; higher numbers refer to related academic papers from the list.",

      "End with a dedicated ## References section mapping each marker to its source (file name or paper title with URL when provided).",

      "If a claim cannot be tied to a listed source, state uncertainty instead of inventing citations.",
    ],

    chatInstructions: [
      "Provide lecturer-grade answers with precise terminology and concise justifications.",

      "For non-trivial factual claims, use inline numeric citation markers like [1], [2].",

      "Always end with a 'References' section listing each cited source with title and URL/domain.",

      "If evidence is insufficient, explicitly mark uncertainty instead of inventing citations.",

      "When the user asks for references or more sources, combine web and academic hits from the numbered list; prefer URL-backed sources.",
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

export function buildSourceDocumentList(documents) {
  return (documents || [])

    .map(
      (doc, i) => `[${i + 1}] ${String(doc?.name || "Untitled source").trim()}`,
    )

    .filter(Boolean);
}

/**

 * @param {number} uploadCount - number of uploaded source documents

 */

export function getLecturerSummaryCitationRules(uploadCount = 0) {
  const uploadNote =
    uploadCount > 0
      ? `- Markers [1]–[${uploadCount}] are uploaded lecture/source files. Higher markers are related academic papers from the list below.`
      : "- Use markers only from the numbered source list below.";

  return `

Citation requirements for lecturer mode:

- Every meaningful factual claim should include inline citation markers like [1], [2].

- Cite ONLY from the numbered sources in the prompt below (uploaded files and related papers). Do not invent sources.

${uploadNote}

- For paper sources, use markdown links in the References section: [Paper title](URL) using the exact URL from the source list.

- End with a dedicated "## References" section listing ONLY marker numbers you actually used inline in the summary body (do not list unused sources).

- Do not fabricate URLs, DOIs, or papers not listed below.

- Do not cite academic papers unless they substantively support a claim in your summary.

- If no source supports a claim, explicitly state uncertainty instead of inventing citations.

`.trim();
}

export function hasReferencesSection(markdown) {
  return /\n#{1,3}\s*references\s*\n/i.test(String(markdown || ""));
}

/**

 * Build References markdown from a full catalog (uploads + papers).

 * @param {{ marker: number, kind: string, title: string, authors?: string|null, year?: number|null, url?: string|null, doi?: string|null }[]} catalog

 */

export function buildReferencesSectionFromCatalog(catalog) {
  return buildReferencesSectionMarkdown(catalog);
}

/** Ensures lecturer summaries always end with a References block. */

export function ensureLecturerSummaryReferences(
  markdown,
  sourceDocuments = [],
  catalog = null,
) {
  const trimmed = String(markdown || "").trim();

  if (!trimmed) return trimmed;

  if (hasReferencesSection(trimmed)) return trimmed;

  const refLines = catalog?.length
    ? buildReferencesSectionFromCatalog(catalog)
    : buildReferencesSectionFromCatalog(
        (sourceDocuments || []).map((doc, i) => ({
          marker: i + 1,

          kind: "upload",

          title: String(doc?.name || "Untitled source").trim(),
        })),
      );

  return `${trimmed}\n\n## References\n${refLines}`;
}
