/**
 * Chat reply reference post-processing (no heavy deps — testable with node --test).
 */

import {
  stripReferencesSection,
  extractCitationMarkers,
} from "./referenceCitationCore.js";

const SCHOLARLY_HOST_FRAGMENTS = [
  "doi.org",
  "semanticscholar.org",
  "arxiv.org",
  "ieee.org",
  "ieeexplore.ieee.org",
  "acm.org",
  "dl.acm.org",
  "link.springer.com",
  "springer.com",
  "springerlink.com",
  "sciencedirect.com",
  "wiley.com",
  "nature.com",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "researchgate.net",
  "tandfonline.com",
  "sagepub.com",
  "mdpi.com",
  "jstor.org",
  "openalex.org",
  "frontiersin.org",
  "cambridge.org",
  "oup.com",
];

const NOT_FOUND_LINE =
  "- No articles with accessible links were found for this search.";

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeDoi(doi) {
  if (!doi) return null;
  return String(doi)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim()
    .toLowerCase();
}

/**
 * @param {{ url?: string | null; doi?: string | null }} source
 */
export function sourceAccessUrl(source) {
  if (!source) return null;
  if (isHttpUrl(source.url)) return String(source.url).trim();
  const doi = normalizeDoi(source.doi);
  if (doi) return `https://doi.org/${doi}`;
  return null;
}

function isScholarlyHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SCHOLARLY_HOST_FRAGMENTS.some(
      (f) => host === f || host.endsWith(`.${f}`),
    );
  } catch {
    return false;
  }
}

function hasBrokenReferenceTitle(title) {
  const t = String(title || "").trim();
  if (t.length < 8) return true;
  if (/\[\[PDF\]/i.test(t)) return true;
  if (/\.(pdf|docx?|pptx?)\)?$/i.test(t) && !/\]\(https?:\/\//i.test(t))
    return true;
  if (/\d{2,4}\/\d+\/\d+.*\.pdf/i.test(t)) return true;
  if (/\bflashcards?\b/i.test(t)) return true;
  return false;
}

/**
 * @param {{ kind?: string; title?: string; url?: string | null; doi?: string | null }} source
 * @param {string} summaryTitle
 * @param {{ articlesOnly?: boolean }} [opts]
 */
export function isUsableReferenceSource(source, summaryTitle = "", opts = {}) {
  if (!source || looksLikeLectureSource(source, summaryTitle)) return false;
  if (hasBrokenReferenceTitle(source.title)) return false;

  const access = sourceAccessUrl(source);
  if (!access || !isHttpUrl(access)) return false;

  if (source.kind === "paper") return true;

  if (source.kind === "web") {
    if (opts.articlesOnly) return false;
    return isScholarlyHost(access);
  }

  return false;
}

/**
 * @param {{ kind?: string; title?: string; url?: string | null }} source
 * @param {string} summaryTitle
 */
export function looksLikeLectureSource(source, summaryTitle) {
  if (!source) return true;
  if (source.kind !== "web" && source.kind !== "paper") return true;
  const title = String(source.title || "")
    .trim()
    .toLowerCase();
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
 */
export function stripNumericCitationMarkers(markdown) {
  const body = stripReferencesSection(markdown);
  return body.replace(/\[(\d{1,3})\](?!\()/g, "").replace(/  +/g, " ");
}

function normalizeUrlForMatch(url) {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

/**
 * @param {string} markdown
 */
function extractMarkdownLinkUrls(markdown) {
  const urls = new Set();
  const re = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
  let m;
  while ((m = re.exec(String(markdown || "")))) {
    urls.add(normalizeUrlForMatch(m[1]));
  }
  return urls;
}

/**
 * @param {{ title?: string; authors?: string | null; year?: number | null; url?: string | null; doi?: string | null }} source
 */
export function formatReferenceBullet(source) {
  const url = sourceAccessUrl(source);
  if (!url) return null;
  const title = String(source.title || "Untitled").trim();
  let line = `- [${title}](${url})`;
  const meta = [source.authors, source.year ? `(${source.year})` : ""]
    .filter(Boolean)
    .join(" ");
  if (meta) line += ` — ${meta}`;
  return line;
}

/**
 * @param {Array<{ marker?: number; kind?: string; title?: string; url?: string | null; doi?: string | null }>} sources
 * @param {string} userText
 * @param {string} summaryTitle
 */
export function rankChatReferenceSources(sources, userText, summaryTitle) {
  const articlesOnly = userWantsArticles(userText);
  const papers = [];
  const web = [];
  for (const s of sources || []) {
    if (!isUsableReferenceSource(s, summaryTitle, { articlesOnly })) continue;
    if (s.kind === "paper") papers.push(s);
    else web.push(s);
  }
  return [...papers, ...web];
}

/**
 * User asked for journal articles / papers (not generic web pages).
 * @param {string} content
 */
export function userWantsArticles(content) {
  const t = String(content || "")
    .trim()
    .toLowerCase();
  if (t.length < 4) return false;
  return (
    /\b(articles?|journals?|papers?|publications?|peer[- ]?reviewed)\b/.test(
      t,
    ) || /\b(find|look)\s+(for\s+)?(journals?|papers?|articles?)\b/.test(t)
  );
}

/** Inline [1] markers in the reply body are disabled for a cleaner UI. */
export function userWantsNumericCitations() {
  return false;
}

/**
 * @param {string} markdown
 * @param {Array<{ marker?: number; kind?: string; title?: string; url?: string | null; doi?: string | null; authors?: string | null; year?: number | null }>} chatSources
 * @param {{ wantsReferences: boolean; summarizeRole: string; summaryTitle?: string; userText?: string }} opts
 */
export function finalizeChatReplyReferences(
  markdown,
  chatSources,
  { wantsReferences, summarizeRole, summaryTitle = "", userText = "" },
) {
  let body = stripReferencesSection(markdown).trim();
  body = stripNumericCitationMarkers(body).trim();

  if (!wantsReferences) {
    if (summarizeRole === "lecturer") {
      return body;
    }
    return String(markdown || "").trim();
  }

  const articlesOnly = userWantsArticles(userText);
  const rawBody = stripReferencesSection(markdown);
  const citedMarkers = new Set(extractCitationMarkers(rawBody));
  const linkedUrls = extractMarkdownLinkUrls(rawBody);

  let refsForSection = chatSources.filter((s) => {
    if (!isUsableReferenceSource(s, summaryTitle, { articlesOnly }))
      return false;
    if (citedMarkers.size > 0 && citedMarkers.has(Number(s.marker)))
      return true;
    const access = sourceAccessUrl(s);
    if (!access) return false;
    return linkedUrls.has(normalizeUrlForMatch(access));
  });

  const seenUrl = new Set();
  refsForSection = refsForSection.filter((s) => {
    const u = normalizeUrlForMatch(sourceAccessUrl(s));
    if (!u || seenUrl.has(u)) return false;
    seenUrl.add(u);
    return true;
  });

  const lines = refsForSection
    .map((s) => formatReferenceBullet(s))
    .filter(Boolean);

  if (lines.length === 0) {
    return `${body}\n\n## References\n${NOT_FOUND_LINE}`;
  }

  return `${body}\n\n## References\n${lines.join("\n")}`;
}
