/**
 * Chat reply reference post-processing (no heavy deps — testable with node --test).
 */

import {
  stripReferencesSection,
  extractCitationMarkers,
} from "./referenceCitationCore.js";

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {{ kind?: string; title?: string; url?: string | null }} source
 * @param {string} summaryTitle
 */
export function looksLikeLectureSource(source, summaryTitle) {
  if (!source) return true;
  if (source.kind !== "web" && source.kind !== "paper") return true;
  const title = String(source.title || "").trim().toLowerCase();
  const summary = String(summaryTitle || "")
    .trim()
    .toLowerCase();
  if (summary && title && (title === summary || title.includes(summary))) {
    return true;
  }
  const lectureHints = [
    "lecture note",
    "slide deck",
    "powerpoint",
    "uploaded file",
    "course material",
    "untitled",
    "generated summary",
    "slide2notes",
  ];
  if (lectureHints.some((h) => title.includes(h))) return true;
  if (!isHttpUrl(source.url) && source.kind === "web") return true;
  return false;
}

/**
 * @param {string} markdown
 * @param {Array<{ marker?: number; kind?: string; title?: string; url?: string | null }>} chatSources
 * @param {{ wantsReferences: boolean; summarizeRole: string; summaryTitle?: string }} opts
 */
export function finalizeChatReplyReferences(
  markdown,
  chatSources,
  { wantsReferences, summarizeRole, summaryTitle = "" },
) {
  const body = stripReferencesSection(markdown).trim();

  if (!wantsReferences) {
    if (summarizeRole === "lecturer") {
      return body;
    }
    return String(markdown || "").trim();
  }

  const citedMarkers = new Set(extractCitationMarkers(body));
  let refsForSection =
    citedMarkers.size > 0
      ? chatSources.filter((s) => citedMarkers.has(Number(s.marker)))
      : [];

  refsForSection = refsForSection.filter(
    (s) => !looksLikeLectureSource(s, summaryTitle),
  );

  if (refsForSection.length === 0) {
    return `${body}\n\n## References\n- No verifiable web or journal sources were cited for this reply. Try rephrasing or check that reference search found results.`;
  }

  const lines = refsForSection.map((s) => {
    const link = isHttpUrl(s.url)
      ? `[${s.title}](${s.url})`
      : s.title;
    return `- [${s.marker}] ${link}`;
  });
  return `${body}\n\n## References\n${lines.join("\n")}`;
}
