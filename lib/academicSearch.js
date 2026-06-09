/**
 * Academic paper search for lecturer-mode summaries.
 * Semantic Scholar (primary) + OpenAlex (backup).
 */

import {
  filterPapersByPublishedYear,
  openAlexYearFilterParam,
} from "./publishedYearFilter.js";
import { generateAcademicSearchQueriesWithLlm } from "./academicSearchQueries.js";

const S2_BASE = "https://api.semanticscholar.org/graph/v1";
const OPENALEX_BASE = "https://api.openalex.org";

const MAX_RESULTS = Math.min(
  10,
  Math.max(
    1,
    Number.parseInt(process.env.ACADEMIC_SEARCH_MAX_RESULTS || "8", 10),
  ),
);
const TIMEOUT_MS = Math.max(
  3000,
  Number.parseInt(process.env.ACADEMIC_SEARCH_TIMEOUT_MS || "10000", 10),
);
const MAX_QUERIES = 5;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "we",
  "our",
  "you",
  "your",
  "they",
  "their",
  "he",
  "she",
  "his",
  "her",
  "not",
  "no",
  "can",
  "all",
  "each",
  "which",
  "when",
  "where",
  "how",
  "what",
  "who",
  "why",
  "if",
  "than",
  "then",
  "also",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "over",
  "about",
  "such",
  "only",
  "other",
  "some",
  "more",
  "most",
  "very",
  "just",
  "using",
  "use",
  "used",
  "based",
  "including",
  "include",
  "slide",
  "slides",
  "lecture",
  "chapter",
]);

function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() =>
    clearTimeout(t),
  );
}

function normalizeDoi(doi) {
  if (!doi) return null;
  return String(doi)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim()
    .toLowerCase();
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @typedef {{ title: string, authors: string|null, year: number|null, venue: string|null, doi: string|null, url: string|null, abstract: string|null, provider: string, externalId: string|null }} PaperHit */

/**
 * Build 3–5 search queries from extracted lecture text and document names.
 * @param {string} combinedText
 * @param {{ name?: string }[]} documents
 */
export function buildSearchQueries(combinedText, documents = []) {
  const queries = [];
  const names = (documents || [])
    .map((d) => String(d?.name || "").replace(/\.[^/.]+$/, ""))
    .filter((n) => n.length > 3);
  if (names[0]) queries.push(names[0].slice(0, 120));

  const text = String(combinedText || "").slice(0, 8000);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  const freq = new Map();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const topTerms = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);

  if (topTerms.length >= 3) {
    queries.push(topTerms.slice(0, 5).join(" "));
    queries.push(topTerms.slice(0, 8).join(" "));
  }

  const headingMatch = text.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch?.[1]) {
    const h = headingMatch[1].trim().slice(0, 100);
    if (h.length > 5) queries.push(h);
  }

  const seen = new Set();
  return queries
    .map((q) => q.trim())
    .filter((q) => q.length > 4)
    .filter((q) => {
      const key = q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_QUERIES);
}

/**
 * @param {string[]} primary
 * @param {string[]} fallback
 * @param {number} [max]
 */
export function mergeSearchQueries(primary, fallback, max = MAX_QUERIES) {
  const seen = new Set();
  const out = [];
  for (const q of [...(primary || []), ...(fallback || [])]) {
    const trimmed = String(q || "")
      .trim()
      .slice(0, 120);
    const key = trimmed.toLowerCase();
    if (trimmed.length <= 4 || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Tokenize phrases for relevance scoring (LLM terms + query words + freq fallback).
 * @param {string} combinedText
 * @param {{ keyTerms?: string[]; queries?: string[] }} [extra]
 */
export function buildRelevanceTermSet(combinedText, extra = {}) {
  const set = new Set(extractTopTerms(combinedText, 16));

  const addPhraseTokens = (phrase) => {
    for (const w of String(phrase || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)) {
      if (w.length > 3 && !STOP_WORDS.has(w)) set.add(w);
    }
  };

  for (const t of extra.keyTerms || []) addPhraseTokens(t);
  for (const q of extra.queries || []) addPhraseTokens(q);

  return [...set].slice(0, 28);
}

/**
 * @param {string} combinedText
 * @param {{ name?: string }[]} documents
 * @param {{ model?: string; modelVariant?: string | null } | null} [llmOpts]
 */
export async function resolveAcademicSearchPlan(
  combinedText,
  documents = [],
  llmOpts = null,
  onProgress = null,
) {
  const fallbackQueries = buildSearchQueries(combinedText, documents);
  let queries = fallbackQueries;
  let relevanceTerms = extractTopTerms(combinedText, 24);

  if (llmOpts?.model) {
    onProgress?.({ step: "generating_queries" });
    const { queries: llmQueries, keyTerms } =
      await generateAcademicSearchQueriesWithLlm(
        combinedText,
        documents,
        llmOpts,
      );
    if (llmQueries.length > 0) {
      queries = mergeSearchQueries(llmQueries, fallbackQueries);
    }
    if (llmQueries.length > 0 || keyTerms.length > 0) {
      relevanceTerms = buildRelevanceTermSet(combinedText, {
        keyTerms,
        queries: llmQueries.length > 0 ? llmQueries : queries,
      });
    }
  }

  if (queries.length > 0) {
    onProgress?.({ step: "queries_ready", queries });
  }

  return { queries, relevanceTerms };
}

const CHAT_REQUEST_BOILERPLATE =
  /\b(find|list|show|give|get|search|look)\b|\b(for|me)\b|\b(journals?|papers?|articles?|sources?|references?|bibliography)\b|\b(related\s+to|about|on|regarding)\b|\b(academic|peer[- ]?reviewed|scholarly)\b|\b(more|some|any)\b/gi;

/**
 * Topic phrase from a chat message (e.g. "white-box" from "find journals related to white-box").
 * @param {string} userText
 */
export function extractChatSearchTopic(userText) {
  const user = String(userText || "")
    .trim()
    .replace(CHAT_REQUEST_BOILERPLATE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return user.length >= 3 ? user : "";
}

/**
 * Academic queries for chat reference mode — prioritize the user's topic, not lecture word frequency.
 * @param {string} userText
 * @param {string} [summaryTitle]
 * @param {string} [summaryExcerpt]
 */
export function buildChatAcademicQueries(
  userText,
  summaryTitle = "",
  summaryExcerpt = "",
) {
  const queries = [];
  const user = String(userText || "").trim();
  const topic = extractChatSearchTopic(userText);

  if (topic) {
    queries.push(topic.slice(0, 120));
    const spaced = topic.replace(/-/g, " ").replace(/\s+/g, " ").trim();
    if (spaced.length >= 3 && spaced.toLowerCase() !== topic.toLowerCase()) {
      queries.push(spaced.slice(0, 120));
    }
    const contextBlob = `${user} ${summaryExcerpt}`.toLowerCase();
    if (
      spaced &&
      !/\btesting\b/i.test(topic) &&
      /\btesting\b/i.test(contextBlob)
    ) {
      queries.push(`${spaced} testing`.slice(0, 120));
    }
  }
  if (user.length >= 4 && user.length <= 160) {
    queries.push(user.slice(0, 120));
  }

  const seed = [userText, summaryTitle, summaryExcerpt]
    .filter(Boolean)
    .join("\n");
  const fromLecture = buildSearchQueries(seed, [{ name: summaryTitle }]);
  queries.push(
    ...fromLecture.slice(0, Math.max(1, MAX_QUERIES - queries.length)),
  );

  const seen = new Set();
  return queries
    .map((q) => q.trim())
    .filter((q) => q.length > 4)
    .filter((q) => {
      const key = q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_QUERIES);
}

/**
 * @param {string} text
 */
function topicTermsForRelevance(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Chat follow-up paper search (user topic first; avoids "find journals related" style queries).
 * @param {{ userText: string, summaryTitle?: string, summaryExcerpt?: string }} opts
 * @returns {Promise<PaperHit[]>}
 */
export async function fetchRelatedPapersForChat({
  userText,
  summaryTitle = "",
  summaryExcerpt = "",
}) {
  const queries = buildChatAcademicQueries(
    userText,
    summaryTitle,
    summaryExcerpt,
  );
  if (queries.length === 0) return [];

  const perQuery = Math.max(2, Math.ceil(MAX_RESULTS / queries.length));
  const allHits = [];

  try {
    await Promise.all(
      queries.map(async (q) => {
        const [s2, oa] = await Promise.all([
          searchSemanticScholar(q, perQuery),
          searchOpenAlex(q, perQuery),
        ]);
        allHits.push(...s2, ...oa);
      }),
    );
  } catch (e) {
    console.warn("Chat academic search batch failed:", e?.message);
  }

  const merged = mergeAndDedupeResults(allHits);
  const topic = extractChatSearchTopic(userText);
  const relevanceSeed = topic
    ? `${topic} ${topic.replace(/-/g, " ")}`
    : [userText, summaryTitle, summaryExcerpt].filter(Boolean).join("\n");
  const topicTerms = topicTermsForRelevance(relevanceSeed);
  const minScore = topicTerms.length > 0 ? 1 : 2;
  const relevant = filterPapersByRelevance(merged, relevanceSeed, {
    minScore,
    max: MAX_RESULTS,
  });
  if (relevant.length > 0) return relevant;
  if (minScore > 1) {
    const relaxed = filterPapersByRelevance(merged, relevanceSeed, {
      minScore: 1,
      max: MAX_RESULTS,
    });
    if (relaxed.length > 0) return relaxed;
  }
  return merged.slice(0, MAX_RESULTS);
}

/**
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<PaperHit[]>}
 */
export async function searchSemanticScholar(query, limit = 5) {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const q = encodeURIComponent(
    String(query || "")
      .trim()
      .slice(0, 200),
  );
  if (!q) return [];

  const fields = [
    "paperId",
    "title",
    "abstract",
    "year",
    "venue",
    "authors",
    "externalIds",
    "openAccessPdf",
    "url",
  ].join(",");
  const url = `${S2_BASE}/paper/search?query=${q}&limit=${limit}&fields=${fields}`;

  const headers = { Accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  try {
    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) {
      console.warn("Semantic Scholar search HTTP", res.status, query);
      return [];
    }
    const data = await res.json();
    const papers = data?.data || [];
    return papers.map((p) => {
      const doi = p.externalIds?.DOI || p.externalIds?.doi || null;
      const authors = (p.authors || [])
        .map((a) => a.name)
        .filter(Boolean)
        .slice(0, 5)
        .join(", ");
      const urlOut =
        p.openAccessPdf?.url ||
        (doi ? `https://doi.org/${normalizeDoi(doi)}` : null) ||
        p.url ||
        null;
      return {
        title: String(p.title || "Untitled").trim(),
        authors: authors || null,
        year: p.year ?? null,
        venue: p.venue || null,
        doi: doi ? normalizeDoi(doi) : null,
        url: urlOut,
        abstract: p.abstract ? String(p.abstract).slice(0, 500) : null,
        provider: "semantic_scholar",
        externalId: p.paperId || null,
      };
    });
  } catch (e) {
    console.warn("Semantic Scholar search failed:", e?.message);
    return [];
  }
}

let openAlexKeyWarned = false;

/** Free API key from https://openalex.org/settings/api (replaces deprecated mailto= polite pool). */
export function resolveOpenAlexApiKey() {
  const key = String(
    process.env.OPENALEX_API_KEY || process.env.OPENALEX_KEY || "",
  ).trim();
  return key || null;
}

/**
 * @param {string} query
 * @param {number} limit
 * @param {{ from: number | null; to: number | null; active?: boolean } | null} [yearRange]
 */
export function buildOpenAlexWorksSearchParams(query, limit, yearRange = null) {
  const params = new URLSearchParams({
    search: String(query || "")
      .trim()
      .slice(0, 200),
    per_page: String(limit),
    sort: "relevance_score:desc",
  });
  const yearFilter = openAlexYearFilterParam(yearRange);
  if (yearFilter) params.set("filter", yearFilter);
  const apiKey = resolveOpenAlexApiKey();
  if (apiKey) params.set("api_key", apiKey);
  return params;
}

/**
 * @param {string} query
 * @param {number} limit
 * @param {{ from: number | null; to: number | null; active?: boolean } | null} [yearRange]
 * @returns {Promise<PaperHit[]>}
 */
export async function searchOpenAlex(query, limit = 5, yearRange = null) {
  const trimmed = String(query || "")
    .trim()
    .slice(0, 200);
  if (!trimmed) return [];

  const apiKey = resolveOpenAlexApiKey();
  if (!apiKey && !openAlexKeyWarned) {
    openAlexKeyWarned = true;
    console.warn(
      "OpenAlex: set OPENALEX_API_KEY in .env (free at openalex.org/settings/api). Without a key, rate limits are very low.",
    );
  }

  const params = buildOpenAlexWorksSearchParams(trimmed, limit, yearRange);
  const url = `${OPENALEX_BASE}/works?${params}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json", "User-Agent": "Slide2Notes/1.0" },
    });
    if (!res.ok) {
      if (res.status === 409) {
        console.warn(
          "OpenAlex search rate limited or credits exhausted — add OPENALEX_API_KEY",
          trimmed,
        );
      } else {
        console.warn("OpenAlex search HTTP", res.status, trimmed);
      }
      return [];
    }
    const data = await res.json();
    const works = data?.results || [];
    return works.map((w) => {
      const doi = normalizeDoi(w.doi || w.ids?.doi);
      const authors = (w.authorships || [])
        .map((a) => a.author?.display_name)
        .filter(Boolean)
        .slice(0, 5)
        .join(", ");
      const venue =
        w.primary_location?.source?.display_name ||
        w.host_venue?.display_name ||
        null;
      const urlOut =
        w.primary_location?.landing_page_url ||
        w.open_access?.oa_url ||
        (doi ? `https://doi.org/${doi}` : null) ||
        w.id ||
        null;
      const year = w.publication_year ?? null;
      return {
        title: String(w.title || w.display_name || "Untitled")
          .replace(/<[^>]+>/g, "")
          .trim(),
        authors: authors || null,
        year,
        venue,
        doi,
        url: urlOut,
        abstract: w.abstract_inverted_index
          ? reconstructOpenAlexAbstract(w.abstract_inverted_index).slice(0, 500)
          : null,
        provider: "openalex",
        externalId: w.id
          ? String(w.id).replace("https://openalex.org/", "")
          : null,
      };
    });
  } catch (e) {
    console.warn("OpenAlex search failed:", e?.message);
    return [];
  }
}

function reconstructOpenAlexAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return "";
  const positions = [];
  for (const [word, idxs] of Object.entries(invertedIndex)) {
    for (const i of idxs) positions.push([i, word]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  return positions.map((p) => p[1]).join(" ");
}

/**
 * @param {PaperHit[]} hits
 * @returns {PaperHit[]}
 */
export function mergeAndDedupeResults(hits) {
  const byKey = new Map();
  for (const hit of hits) {
    if (!hit?.title) continue;
    const doi = normalizeDoi(hit.doi);
    const key = doi || normalizeTitle(hit.title);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, hit);
      continue;
    }
    if (!existing.url && hit.url) byKey.set(key, hit);
    else if (!existing.abstract && hit.abstract)
      byKey.set(key, { ...existing, abstract: hit.abstract });
  }
  return [...byKey.values()];
}

/**
 * Run academic search with timeout; returns deduped papers.
 * @param {string} combinedText
 * @param {{ name?: string }[]} documents
 * @param {{ from: number | null; to: number | null; active?: boolean } | null} [yearRange]
 * @param {{ model?: string; modelVariant?: string | null } | null} [llmOpts]
 * @returns {Promise<PaperHit[]>}
 */
export async function fetchRelatedPapers(
  combinedText,
  documents = [],
  yearRange = null,
  llmOpts = null,
  onProgress = null,
) {
  const report = (detail) => onProgress?.(detail);

  const { queries, relevanceTerms } = await resolveAcademicSearchPlan(
    combinedText,
    documents,
    llmOpts,
    report,
  );
  if (queries.length === 0) {
    report({ step: "complete", paperCount: 0, papers: [] });
    return [];
  }

  report({
    step: "searching",
    queries,
    providers: ["semantic_scholar", "openalex"],
  });

  const perQuery = Math.max(2, Math.ceil(MAX_RESULTS / queries.length));
  const allHits = [];

  try {
    await Promise.all(
      queries.map(async (q) => {
        const [s2, oa] = await Promise.all([
          searchSemanticScholar(q, perQuery),
          searchOpenAlex(q, perQuery, yearRange),
        ]);
        allHits.push(...s2, ...oa);
      }),
    );
  } catch (e) {
    console.warn("Academic search batch failed:", e?.message);
  }

  report({ step: "filtering" });

  const merged = mergeAndDedupeResults(allHits);
  const results = pickAcademicSearchResults(merged, combinedText, yearRange, {
    terms: relevanceTerms,
  });

  report({
    step: "complete",
    paperCount: results.length,
    papers: results.slice(0, 6).map((p) => ({
      title: p.title,
      year: p.year ?? null,
    })),
  });

  return results;
}

/**
 * Relevance + year filters can return nothing for niche topics; relax before giving up.
 * @param {PaperHit[]} merged
 * @param {string} combinedText
 * @param {{ from: number | null; to: number | null; active?: boolean } | null} yearRange
 * @param {{ terms?: string[]; minScore?: number }} [opts]
 */
export function pickAcademicSearchResults(
  merged,
  combinedText,
  yearRange = null,
  opts = {},
) {
  const terms = opts.terms;
  const tryPick = (minScore) =>
    filterPapersByPublishedYear(
      filterPapersByRelevance(merged, combinedText, {
        terms,
        minScore,
      }),
      yearRange,
    );

  const strict = tryPick(opts.minScore ?? 2);
  if (strict.length > 0) return strict;

  const relaxed = tryPick(1);
  if (relaxed.length > 0) return relaxed;

  return filterPapersByPublishedYear(merged.slice(0, MAX_RESULTS), yearRange);
}

/**
 * Top content terms for relevance scoring (aligned with buildSearchQueries).
 * @param {string} combinedText
 * @param {number} limit
 */
export function extractTopTerms(combinedText, limit = 20) {
  const text = String(combinedText || "").slice(0, 8000);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  const freq = new Map();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

/**
 * Drop loosely related papers before they enter the citation catalog.
 * @param {PaperHit[]} papers
 * @param {string} combinedText
 * @param {{ minScore?: number; max?: number; terms?: string[] }} [opts]
 */
export function filterPapersByRelevance(papers, combinedText, opts = {}) {
  const minScore = opts.minScore ?? 2;
  const max = opts.max ?? MAX_RESULTS;
  const terms =
    Array.isArray(opts.terms) && opts.terms.length > 0
      ? opts.terms
      : extractTopTerms(combinedText, 24);
  if (!terms.length) return (papers || []).slice(0, max);

  const termSet = new Set(terms);
  const scored = (papers || [])
    .map((p) => {
      const blob = `${normalizeTitle(p.title)} ${normalizeTitle(p.abstract || "")}`;
      const words = blob.split(/\s+/).filter((w) => w.length > 3);
      let score = 0;
      for (const w of words) {
        if (termSet.has(w)) score += 1;
      }
      return { p, score };
    })
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, max).map((x) => x.p);
}

/**
 * Build numbered catalog for LLM prompt.
 * @param {{ name?: string }[]} uploadDocs
 * @param {PaperHit[]} papers
 */
export function buildReferenceCatalog(uploadDocs, papers) {
  const uploadCount = (uploadDocs || []).length;
  const lines = [];
  const catalog = [];
  let nextMarker = 1;

  (uploadDocs || []).forEach((doc) => {
    const name = String(doc?.name || "Untitled source").trim();
    const sourceUrl = String(doc?.sourceUrl || "").trim();
    if (!sourceUrl) return;
    const marker = nextMarker++;
    lines.push(`[${marker}] (web) ${name} | URL: ${sourceUrl}`);
    catalog.push({
      marker,
      kind: "web",
      title: name,
      authors: null,
      year: null,
      venue: null,
      doi: null,
      url: sourceUrl,
      abstract: null,
      provider: "web-import",
      externalId: String(doc?.id ?? sourceUrl),
    });
  });

  (papers || []).forEach((paper) => {
    const marker = nextMarker++;
    const authorPart = paper.authors ? ` — ${paper.authors}` : "";
    const yearPart = paper.year ? ` (${paper.year})` : "";
    const urlPart = paper.url ? ` | URL: ${paper.url}` : "";
    const doiPart = paper.doi ? ` | DOI: ${paper.doi}` : "";
    lines.push(
      `[${marker}] (paper) ${paper.title}${authorPart}${yearPart}${doiPart}${urlPart}`,
    );
    catalog.push({
      marker,
      kind: "paper",
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      venue: paper.venue,
      doi: paper.doi,
      url: paper.url,
      abstract: paper.abstract,
      provider: paper.provider,
      externalId: paper.externalId,
    });
  });

  const uploadNames = (uploadDocs || [])
    .filter((doc) => !String(doc?.sourceUrl || "").trim())
    .map((doc) => String(doc?.name || "Untitled source").trim())
    .filter(Boolean);

  return {
    lines,
    catalog,
    uploadCount,
    uploadNames,
    maxMarker: catalog.length,
  };
}
