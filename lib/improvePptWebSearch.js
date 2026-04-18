/**
 * Web search enrichment for the Improve PPT content pipeline.
 *
 * For each slide, queries Tavily with a focused search term derived from
 * the slide's title/text. Returns enriched context per slide plus a
 * deduplicated reference list for the References slide.
 *
 * Requires TAVILY_API_KEY in environment. Gracefully skips if not set.
 *
 * FIX: Searches now run in parallel (Promise.all) instead of serially,
 * reducing total Tavily time from ~20s to ~3-5s for a 20-slide deck.
 * Thin section-divider slides (< 3 lines, < 40 chars) are skipped to
 * avoid wasted API calls on slides like "Software Maintenance / Key Strategies".
 */

const TAVILY_URL = "https://api.tavily.com/search";
const MAX_SNIPPET_CHARS = 800;
const MAX_RESULTS_PER_SLIDE = 3;

/**
 * Extract a concise search query from a slide's parsed content.
 * @param {{ index: number; text: string; lines: string[] }} slide
 * @returns {string}
 */
function buildSearchQuery(slide) {
  // Use the first non-trivial line as the topic anchor
  const lines = (slide.lines || []).map((l) => String(l).trim()).filter(Boolean);
  const firstMeaningful = lines.find((l) => l.length > 8) || String(slide.text || "").trim();

  // Strip trailing punctuation, keep first ~80 chars
  return firstMeaningful
    .replace(/[.:;,!?]+$/, "")
    .trim()
    .slice(0, 80);
}

/**
 * Returns true if a slide is a thin section-divider (e.g. "Key Strategies" title-only)
 * that won't benefit from web enrichment.
 * @param {{ text: string; lines: string[] }} slide
 * @returns {boolean}
 */
function isDividerSlide(slide) {
  const text = String(slide.text || "").trim();
  const lines = (slide.lines || []).filter((l) => String(l).trim().length > 0);
  // Skip if very short total text OR very few lines (title-only section dividers)
  return text.length < 40 || lines.length < 3;
}

/**
 * @typedef {{ title: string; url: string; snippet: string }} SearchResult
 */

/**
 * Run a single Tavily search and return structured results.
 * @param {string} query
 * @param {string} apiKey
 * @returns {Promise<SearchResult[]>}
 */
async function tavilySearch(query, apiKey) {
  const q = String(query || "").trim().slice(0, 300);
  if (!q) return [];

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: q,
        search_depth: "basic",
        max_results: MAX_RESULTS_PER_SLIDE,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn("Tavily search HTTP error:", res.status, "for query:", q);
      return [];
    }

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    return results
      .map((r) => ({
        title: String(r?.title || "").trim().slice(0, 200),
        url: String(r?.url || "").trim(),
        snippet: String(r?.content || r?.description || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, MAX_SNIPPET_CHARS),
      }))
      .filter((r) => r.url.startsWith("http") && r.snippet);
  } catch (e) {
    console.warn("Tavily search failed:", e?.message || e);
    return [];
  }
}

/**
 * Enrich all slides with web search context.
 * Returns per-slide enrichment and a deduplicated references list.
 *
 * FIX: Runs all Tavily searches in parallel via Promise.all instead of
 * awaiting each one sequentially, cutting total time from O(n*15s) to ~5s.
 * Also skips thin divider slides that produce useless results.
 *
 * @param {{ index: number; text: string; lines: string[] }[]} slides
 * @returns {Promise<{
 *   enriched: { slideIndex: number; query: string; context: string; sources: SearchResult[] }[];
 *   allSources: SearchResult[];
 * }>}
 */
export async function enrichSlidesWithWebSearch(slides) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return { enriched: [], allSources: [] };
  }

  // Filter out thin section-divider slides before firing any requests
  const meaningfulSlides = slides.filter((s) => !isDividerSlide(s));

  // Fire all searches in parallel — O(1) wall-clock time instead of O(n)
  const rawResults = await Promise.all(
    meaningfulSlides.map(async (slide) => {
      const query = buildSearchQuery(slide);
      if (!query) return null;
      const hits = await tavilySearch(query, apiKey);
      if (hits.length === 0) return null;
      return { slide, query, hits };
    })
  );

  /** @type {Map<string, SearchResult>} deduplicate by URL */
  const sourceMap = new Map();
  const enriched = [];

  for (const item of rawResults) {
    if (!item) continue;

    for (const r of item.hits) {
      if (!sourceMap.has(r.url)) sourceMap.set(r.url, r);
    }

    const context = item.hits
      .map((r) => `Source: ${r.title}\n${r.snippet}`)
      .join("\n\n");

    enriched.push({
      slideIndex: item.slide.index,
      query: item.query,
      context,
      sources: item.hits,
    });
  }

  return {
    enriched,
    allSources: [...sourceMap.values()],
  };
}

/**
 * Build a compact context string for each slide to inject into the LLM prompt.
 * @param {{ slideIndex: number; context: string }[]} enriched
 * @returns {string}
 */
export function buildEnrichmentBlock(enriched) {
  if (!enriched || enriched.length === 0) return "";
  const lines = enriched.map(
    (e) => `--- Slide ${e.slideIndex} web context ---\n${e.context}`,
  );
  return lines.join("\n\n");
}