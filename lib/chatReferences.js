/**
 * On-demand chat references: web (Tavily) + academic (Semantic Scholar / OpenAlex).
 */

import { fetchTavilySourcesForChat } from "@/lib/tavilySearch";
import { fetchRelatedPapersForChat } from "@/lib/academicSearch";
import {
  finalizeChatReplyReferences,
  looksLikeLectureSource,
  isUsableReferenceSource,
  rankChatReferenceSources,
  userWantsArticles,
  userWantsNumericCitations,
  sourceAccessUrl,
} from "./chatReplyReferences.js";

export {
  finalizeChatReplyReferences,
  looksLikeLectureSource,
  isUsableReferenceSource,
  rankChatReferenceSources,
  userWantsArticles,
  userWantsNumericCitations,
};

const MAX_SOURCES = Math.min(
  16,
  Math.max(
    4,
    Number.parseInt(process.env.CHAT_REFERENCES_MAX_SOURCES || "12", 10),
  ),
);

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * User explicitly asked for citations, bibliography, or linked sources.
 * @param {string} content
 */
export function userRequestedReferences(content) {
  const t = String(content || "")
    .trim()
    .toLowerCase();
  if (t.length < 6) return false;

  const patterns = [
    /\b(cite|citation|citations)\b/,
    /\b(references?|bibliography|works?\s+cited)\b/,
    /\b(sources?|reading\s+list)\b/,
    /\b(papers?|journal\s+articles?|academic\s+(sources?|papers?))\b/,
    /\b(research\s+(on|about|for)|literature\s+review)\b/,
    /\b(where\s+can\s+i\s+(read|learn|find))\b/,
    /\b(provide|give|list|show)\s+(me\s+)?(some\s+)?(links?|urls?|hyperlinks?)\b/,
    /\b(with\s+)?(links?|urls?|hyperlinks?)\b/,
    /\b(back\s*up|support)\s+(this|that|it)\s+with\s+(sources?|evidence|references?)\b/,
    /\bfind\s+(sources?|references?|papers?)\b/,
    /\bmore\s+(sources?|references?|reading)\b/,
  ];

  return patterns.some((re) => re.test(t));
}

/**
 * @param {string} userText
 * @param {string} summaryTitle
 */
export function buildChatReferenceQuery(userText, summaryTitle) {
  const qUser = String(userText || "")
    .trim()
    .slice(0, 220);
  const qTitle = String(summaryTitle || "")
    .trim()
    .slice(0, 80);
  return [qUser, qTitle ? `(Topic: ${qTitle})` : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

/**
 * @typedef {{ marker?: number, kind: 'web'|'paper', title: string, url: string|null, authors: string|null, year: number|null, venue: string|null, doi: string|null, snippet: string|null, provider: string|null }} ChatSource
 */

/**
 * URL-bearing sources first, then title-only.
 * @param {ChatSource[]} sources
 */
export function sortSourcesUrlFirst(sources) {
  return [...sources].sort((a, b) => {
    const aHas = isHttpUrl(a?.url);
    const bHas = isHttpUrl(b?.url);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
}

/**
 * @param {ChatSource[]} sources
 */
export function assignSourceMarkers(sources) {
  return sortSourcesUrlFirst(sources).map((s, i) => ({
    ...s,
    marker: i + 1,
  }));
}

/**
 * @param {ChatSource[]} sources
 */
function dedupeSources(sources) {
  const seen = new Map();
  const out = [];
  for (const s of sources) {
    if (!s?.title) continue;
    const urlKey = isHttpUrl(s.url) ? s.url.toLowerCase() : "";
    const titleKey = normalizeTitle(s.title);
    const key = urlKey || titleKey;
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, s);
      out.push(s);
      continue;
    }
    if (!isHttpUrl(existing.url) && isHttpUrl(s.url)) {
      const idx = out.indexOf(existing);
      if (idx >= 0) out[idx] = s;
      seen.set(key, s);
    }
  }
  return out;
}

/**
 * @param {import('@/lib/academicSearch').PaperHit[]} papers
 * @returns {ChatSource[]}
 */
function papersToSources(papers) {
  return (papers || []).map((p) => ({
    kind: "paper",
    title: p.title,
    url: p.url || (p.doi ? `https://doi.org/${p.doi}` : null),
    authors: p.authors || null,
    year: p.year ?? null,
    venue: p.venue || null,
    doi: p.doi || null,
    snippet: p.abstract ? String(p.abstract).slice(0, 400) : null,
    provider: p.provider || null,
  }));
}

/**
 * @param {{ userText: string, summaryTitle: string, summaryExcerpt?: string }} opts
 * @returns {Promise<{ sources: ChatSource[], webContext: string, academicContext: string, webAttempted: boolean, academicAttempted: boolean }>}
 */
export async function fetchChatReferenceSources({
  userText,
  summaryTitle,
  summaryExcerpt = "",
}) {
  const query = buildChatReferenceQuery(userText, summaryTitle);
  const academicSeed = [userText, summaryTitle, summaryExcerpt]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  let webAttempted = false;
  let academicAttempted = false;
  let webHits = [];
  let webAnswer = "";
  let papers = [];

  const articlesOnly = userWantsArticles(userText);

  if (!articlesOnly) {
    try {
      webAttempted = true;
      const web = await fetchTavilySourcesForChat(query);
      webHits = web.sources || [];
      webAnswer = web.answer || "";
    } catch (e) {
      console.warn("Chat web sources failed:", e?.message);
    }
  }

  try {
    academicAttempted = true;
    papers = await fetchRelatedPapersForChat({
      userText,
      summaryTitle,
      summaryExcerpt,
    });
  } catch (e) {
    console.warn("Chat academic sources failed:", e?.message);
  }

  const webSources = webHits
    .map((w) => ({
      kind: "web",
      title: w.title,
      url: w.url,
      authors: null,
      year: null,
      venue: w.domain || null,
      doi: null,
      snippet: w.snippet || null,
      provider: "tavily",
    }))
    .filter((s) => isUsableReferenceSource(s, summaryTitle, { articlesOnly: false }));

  const paperSources = papersToSources(papers).filter((s) =>
    isUsableReferenceSource(s, summaryTitle, { articlesOnly: true }),
  );

  const merged = dedupeSources([...paperSources, ...webSources])
    .filter((s) =>
      isUsableReferenceSource(s, summaryTitle, { articlesOnly }),
    )
    .slice(0, MAX_SOURCES);
  const sources = assignSourceMarkers(merged);

  let webContext = articlesOnly
    ? ""
    : webHits
        .filter((w) => w.url && isHttpUrl(w.url))
        .map((w) => {
          const snip = w.snippet ? `\n${w.snippet}` : "";
          return `[${w.title}](${w.url})${snip}`;
        })
        .join("\n\n")
        .trim();
  if (!articlesOnly && webAnswer) {
    webContext =
      `Search overview: ${webAnswer}${webContext ? `\n\n${webContext}` : ""}`.trim();
  }

  const academicContext = sources
    .filter((s) => s.kind === "paper")
    .map((s) => {
      const meta = [
        s.authors,
        s.year ? `(${s.year})` : "",
        s.venue,
        s.url ? `URL: ${s.url}` : "",
        s.doi ? `DOI: ${s.doi}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `[${s.marker}] ${s.title}${meta ? ` — ${meta}` : ""}${
        s.snippet ? `\n${s.snippet}` : ""
      }`;
    })
    .join("\n\n");

  return {
    sources,
    webContext,
    academicContext,
    webAttempted,
    academicAttempted,
  };
}

/**
 * @param {ChatSource[]} sources
 */
export function buildNumberedSourcesPrompt(sources) {
  if (!sources?.length) return "";
  return sources
    .map((s) => {
      const access = sourceAccessUrl(s);
      const meta = [
        s.kind === "web" ? "(web)" : "(journal/paper)",
        s.authors,
        s.year ? `(${s.year})` : "",
        s.venue,
        access ? `Link: ${access}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const snip = s.snippet ? `\n  Excerpt: ${s.snippet.slice(0, 350)}` : "";
      return `${s.title} — ${meta}${snip}`;
    })
    .join("\n\n");
}

/**
 * Citation block injected when user asked for references (all roles).
 * @param {{ numericCitations?: boolean }} [_opts]
 */
export function referenceCitationRules(_opts = {}) {
  return `
Reference mode (user asked for articles or sources):
- Use ONLY entries from "Sources found" below. Each entry has a real Link URL.
- In your answer, list recommendations as markdown bullets: [Exact title from list](Link URL). Include author and year when shown.
- Do NOT write a ## References section — the app adds it automatically from your citations.
- Do NOT invent paper titles, DOIs, URLs, or tell the user to search IEEE/ACM/Springer manually.
- If the source list is empty, say clearly that no articles with links were found and stop.
- Do not use numeric markers like [1] or [2] in the reply.
`;
}

/**
 * Lecturer chat when reference search is off (default).
 */
export function lecturerChatWithoutReferenceSearchRules() {
  return `
Lecture materials (reference search off):
- Use the summary and attached uploads as context only. Do not add a ## References or bibliography section.
- Do not use [n] citation markers for the summary or uploaded lecture files; attribute with phrasing like "(from your lecture materials)" when needed.
- External facts may use careful general knowledge labeled **Beyond the summary (general knowledge)** when appropriate.
`;
}

/**
 * @param {ChatSource[]} sources
 */
export function formatSourcesForClient(sources) {
  return (sources || []).map((s) => ({
    marker: s.marker,
    kind: s.kind,
    title: s.title,
    url: sourceAccessUrl(s),
    authors: s.authors,
    year: s.year,
    venue: s.venue,
    doi: s.doi,
    provider: s.provider,
  }));
}
