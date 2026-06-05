/**
 * Optional Tavily web search for summary chat follow-ups.
 * Set TAVILY_API_KEY in the environment to enable (see CHAT_WEB_SEARCH in chat route).
 */

const TAVILY_URL = "https://api.tavily.com/search";

/** Domains that rarely make good lecture summarize sources. */
const SOURCE_SEARCH_EXCLUDE_DOMAINS = [
  "genius.com",
  "azlyrics.com",
  "lyrics.com",
  "metrolyrics.com",
  "songmeanings.com",
  "spotify.com",
  "music.apple.com",
  "soundcloud.com",
  "shazam.com",
  "ultimate-guitar.com",
  "tiktok.com",
  "instagram.com",
  "pinterest.com",
  "amazon.com",
  "ebay.com",
  "imdb.com",
  "rottentomatoes.com",
];

const IRRELEVANT_TITLE_PATTERNS = [
  /\s*\(song\)/i,
  /\s*\(single\)/i,
  /\s*\(album\)/i,
  /\blyrics\b/i,
  /\bofficial\s+(music\s+)?video\b/i,
  /\bfeat\.?\b/i,
];

const TRUSTED_SOURCE_DOMAIN_PATTERNS = [
  /\.edu$/i,
  /\.gov$/i,
  /\.gov\./i,
  /who\.int/i,
  /nih\.gov/i,
  /cdc\.gov/i,
  /noaa\.gov/i,
  /osha\.gov/i,
  /nature\.com/i,
  /sciencedirect/i,
  /springer\.com/i,
  /wiley\.com/i,
  /pnas\.org/i,
  /pubmed/i,
  /ncbi\.nlm/i,
  /redcross/i,
  /unicef/i,
  /wikipedia\.org/i,
  /britannica\.com/i,
];

const MAX_WEB_CONTEXT_CHARS = Number.parseInt(
  process.env.CHAT_WEB_SNIPPET_MAX_CHARS || "6000",
  10,
);

/**
 * True when the user explicitly asks for information beyond the lecture summary
 * (natural-language trigger for Tavily without using the Web search checkbox).
 * @param {string} content
 */
export function userRequestedBeyondSummaryWeb(content) {
  const t = String(content || "")
    .trim()
    .toLowerCase();
  if (t.length < 10) return false;

  const patterns = [
    /\bfind\s+(info|information)\s+other\s+than\b/,
    /\b(other|else)\s+than\s+(what'?s|what is|the\s+)?(existing\s+ones\s+)?(in\s+)?(the\s+)?summary\b/,
    /\b(beyond|outside)\s+(the\s+)?summary\b/,
    /\bnot\s+(in|from|covered\s+in)\s+(the\s+)?summary\b/,
    /\b(additional|extra|external|further)\s+(info|information|context|sources?|details?)\b/,
    /\b(search|look\s*up)\s+(the\s+)?(web|internet)\b/,
    /\bweb\s+search\b/,
    /\bonline\s+(sources?|info|information)\b/,
    /\bfrom\s+the\s+web\b/,
    /\bgoogle\s+(this|it|for)\b/,
  ];

  return patterns.some((re) => re.test(t));
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function tokenizeQuery(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Bias Tavily toward articles, studies, and official reports (NotebookLM-style). */
function buildSourceSearchQuery(query) {
  const q = String(query || "").trim();
  if (!q) return "";
  return `Authoritative articles, research studies, and official reports about ${q}`;
}

/**
 * @param {{ title: string, url: string|null, snippet: string|null, domain: string|null }} source
 * @param {string[]} queryTokens
 */
function scoreSourceRelevance(source, queryTokens) {
  const title = String(source.title || "");
  const snippet = String(source.snippet || "");
  const domain = String(source.domain || "").toLowerCase();
  const blob = `${title} ${snippet} ${domain}`.toLowerCase();

  let score = 10;

  for (const pat of IRRELEVANT_TITLE_PATTERNS) {
    if (pat.test(title)) score -= 40;
  }

  for (const d of SOURCE_SEARCH_EXCLUDE_DOMAINS) {
    if (domain.includes(d) || blob.includes(d)) score -= 50;
  }

  const queryText = queryTokens.join(" ");
  if (/\bheatwave?s?\b/i.test(queryText)) {
    if (/glass animals|song|lyrics|album|single|chart|billboard|spotify/i.test(blob)) {
      score -= 45;
    }
  }

  for (const pat of TRUSTED_SOURCE_DOMAIN_PATTERNS) {
    if (pat.test(domain)) score += 15;
  }

  const infoKeywords =
    /\b(research|study|health|climate|science|article|report|preparedness|effects|impact|official|guidance|policy|extreme heat)\b/gi;
  const infoMatches = `${title} ${snippet}`.match(infoKeywords);
  if (infoMatches) score += Math.min(infoMatches.length * 3, 15);

  for (const tok of queryTokens) {
    if (blob.includes(tok)) score += 2;
  }

  if (!source.url) score -= 20;

  return score;
}

/**
 * @param {{ title: string, url: string|null, snippet: string|null, domain: string|null }[]} sources
 * @param {string} originalQuery
 */
function filterAndRankSources(sources, originalQuery) {
  const tokens = tokenizeQuery(originalQuery);
  const scored = sources
    .map((source) => ({
      source,
      score: scoreSourceRelevance(source, tokens),
    }))
    .filter(({ score }) => score >= 5);

  scored.sort((a, b) => b.score - a.score);
  const ranked = scored.map(({ source }) => source);

  if (ranked.length > 0) return ranked;

  return sources
    .map((source) => ({
      source,
      score: scoreSourceRelevance(source, tokens),
    }))
    .filter(({ score }) => score >= -10)
    .sort((a, b) => b.score - a.score)
    .map(({ source }) => source);
}

/**
 * @param {string} query
 * @param {{ refinedQuery?: string, maxResults?: number, depth?: string, excludeDomains?: string[], includeAnswer?: boolean }} [options]
 * @returns {Promise<{ answer: string, sources: { title: string, url: string|null, snippet: string|null, domain: string|null }[] }>}
 */
async function fetchTavilyRaw(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { answer: "", sources: [] };

  const q = String(query || "")
    .trim()
    .slice(0, 400);
  if (!q) return { answer: "", sources: [] };

  const searchQuery = String(options.refinedQuery || q)
    .trim()
    .slice(0, 400);

  const maxResults = Math.min(
    12,
    Math.max(
      1,
      Number.parseInt(
        String(options.maxResults ?? process.env.TAVILY_MAX_RESULTS ?? "5"),
        10,
      ),
    ),
  );
  const rawDepth = String(options.depth ?? process.env.TAVILY_SEARCH_DEPTH ?? "basic");
  const depth = ["basic", "fast", "advanced", "ultra-fast"].includes(rawDepth)
    ? rawDepth
    : "basic";

  const excludeDomains = Array.isArray(options.excludeDomains)
    ? options.excludeDomains
    : [];

  const payload = {
    api_key: apiKey,
    query: searchQuery,
    search_depth: depth,
    max_results: maxResults,
    include_answer: options.includeAnswer !== false,
  };
  if (excludeDomains.length) {
    payload.exclude_domains = excludeDomains;
  }

  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.warn("Tavily search HTTP error:", res.status);
    return { answer: "", sources: [] };
  }

  const data = await res.json();
  const answer =
    data.answer && String(data.answer).trim() ? String(data.answer).trim() : "";
  const results = Array.isArray(data.results) ? data.results : [];
  const sources = [];

  for (const r of results) {
    const title = (r.title || "Source").trim();
    const url = (r.url || "").trim() || null;
    const snippet = String(r.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1400);
    if (!snippet && !url) continue;
    sources.push({
      title,
      url,
      snippet: snippet || null,
      domain: url ? domainFromUrl(url) : null,
    });
  }

  return { answer, sources };
}

/**
 * @param {string} query
 * @returns {Promise<string>} Formatted excerpts for the system prompt, or "" on skip/failure.
 */
export async function fetchTavilyContextForChat(query) {
  try {
    const { answer, sources } = await fetchTavilyRaw(query);
    let out = "";
    if (answer) out += `Search overview: ${answer}\n\n`;

    for (const s of sources) {
      const line = s.url
        ? `[${s.title}](${s.url})\n${s.snippet || ""}`
        : `${s.title}\n${s.snippet || ""}`;
      out += `${line}\n\n`;
      if (out.length >= MAX_WEB_CONTEXT_CHARS) break;
    }

    return out.slice(0, MAX_WEB_CONTEXT_CHARS).trim();
  } catch (e) {
    console.warn("Tavily search failed:", e?.message || e);
    return "";
  }
}

/**
 * Structured web hits for chat reference UI (URL-first sorting done upstream).
 * @param {string} query
 */
export async function fetchTavilySourcesForChat(query) {
  try {
    const { answer, sources } = await fetchTavilyRaw(query);
    return { answer, sources };
  } catch (e) {
    console.warn("Tavily sources failed:", e?.message || e);
    return { answer: "", sources: [] };
  }
}

/**
 * Web source picker (Add sources modal): deeper search, domain filters, and re-ranking
 * toward articles, research, and official sites.
 * @param {string} query
 */
export async function fetchTavilySourcesForWebSources(query) {
  const originalQuery = String(query || "").trim();
  if (!originalQuery) return { answer: "", sources: [] };

  try {
    const fetchCount = Math.min(
      12,
      Math.max(
        6,
        Number.parseInt(process.env.TAVILY_SOURCES_MAX_RESULTS || "10", 10),
      ),
    );
    const returnCount = Math.min(
      8,
      Math.max(4, Number.parseInt(process.env.TAVILY_MAX_RESULTS || "8", 10)),
    );
    const depth = String(
      process.env.TAVILY_SOURCES_SEARCH_DEPTH || "advanced",
    );
    const safeDepth = ["basic", "fast", "advanced", "ultra-fast"].includes(depth)
      ? depth
      : "advanced";

    const { answer, sources } = await fetchTavilyRaw(originalQuery, {
      refinedQuery: buildSourceSearchQuery(originalQuery),
      maxResults: fetchCount,
      depth: safeDepth,
      excludeDomains: SOURCE_SEARCH_EXCLUDE_DOMAINS,
      includeAnswer: true,
    });

    const ranked = filterAndRankSources(sources, originalQuery);
    return {
      answer,
      sources: ranked.slice(0, returnCount),
    };
  } catch (e) {
    console.warn("Tavily web sources search failed:", e?.message || e);
    return { answer: "", sources: [] };
  }
}
