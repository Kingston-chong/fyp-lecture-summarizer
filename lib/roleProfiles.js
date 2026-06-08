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

      "Do not use [n] citation markers for uploaded lecture files — those are the primary material and are listed under Sources.",

      "Use inline [n] markers only when related external papers appear in the numbered source list below.",

      "Add a ## References section only when you used external paper [n] markers; omit it when no external papers were cited.",

      "If a claim cannot be tied to a listed external source, state uncertainty instead of inventing citations or markers.",
    ],

    chatInstructions: [
      "Provide lecturer-grade answers with precise terminology and concise justifications.",

      "Treat the generated summary and uploaded lecture files as context only — do not list them in a chat References section.",

      "When reference search is enabled, list web and journal hits as markdown links from the source list (title linked to URL). Do not use [1]/[2] markers unless the user asked for numbered citations.",

      "When reference search is off, do not add a ## References section; attribute lecture content with phrasing like (from your lecture materials).",

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

export function getLecturerSummaryCitationRules(externalSourceCount = 0) {
  if (!externalSourceCount) {
    return `

Citation requirements for lecturer mode:

- Do NOT use inline [n] citation markers in this summary.

- Uploaded lecture files are the sole source material (listed under Sources in the app). Attribute ideas with plain phrasing such as "as covered in the lecture" — never [1], [2], etc.

- Do not add a ## References section.

- If no external paper supports a claim, state uncertainty instead of inventing citations.

`.trim();
  }

  return `

Citation requirements for lecturer mode:

- Do NOT use [n] markers for uploaded lecture files.

- Use inline [n] markers only for substantive claims supported by the numbered external sources below (imported web pages and/or academic papers).

- For paper sources, use markdown links in the References section: [Paper title](URL) using the exact URL from the source list.

- End with a "## References" section listing ONLY external marker numbers you actually used inline (do not list unused sources).

- Do not fabricate URLs, DOIs, or papers not listed below.

- If no listed external source supports a claim, explicitly state uncertainty instead of inventing citations.

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
