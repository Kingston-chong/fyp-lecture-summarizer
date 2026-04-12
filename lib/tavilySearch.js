/**
 * Optional Tavily web search for summary chat follow-ups.
 * Set TAVILY_API_KEY in the environment to enable (see CHAT_WEB_SEARCH in chat route).
 */

const TAVILY_URL = "https://api.tavily.com/search";

const MAX_WEB_CONTEXT_CHARS = Number.parseInt(
  process.env.CHAT_WEB_SNIPPET_MAX_CHARS || "6000",
  10
);

/**
 * Heuristic: run web search for elaboration / factual questions, skip trivial replies.
 * @param {string} content
 */
export function shouldAugmentWithWebSearch(content) {
  const t = String(content || "").trim();
  if (t.length < 12) return false;
  if (/^(thanks|thank you|thx|ok|okay|yes|no|yep|nope|nice|cool|got it)\.?$/i.test(t)) {
    return false;
  }
  if (/\?/.test(t)) return true;
  if (t.length > 40) return true;
  return /\b(elaborat|explain|tell me more|what is|what are|who is|who are|describe|more about|background|details?|further|expand|define|meaning of|information (on|about))\b/i.test(
    t
  );
}

/**
 * @param {string} query
 * @returns {Promise<string>} Formatted excerpts for the system prompt, or "" on skip/failure.
 */
export async function fetchTavilyContextForChat(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";

  const q = String(query || "").trim().slice(0, 400);
  if (!q) return "";

  const maxResults = Math.min(
    8,
    Math.max(1, Number.parseInt(process.env.TAVILY_MAX_RESULTS || "5", 10))
  );
  const rawDepth = String(process.env.TAVILY_SEARCH_DEPTH || "basic");
  const depth = ["basic", "fast", "advanced", "ultra-fast"].includes(rawDepth)
    ? rawDepth
    : "basic";

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: q,
        search_depth: depth,
        max_results: maxResults,
        include_answer: true,
      }),
    });

    if (!res.ok) {
      console.warn("Tavily search HTTP error:", res.status);
      return "";
    }

    const data = await res.json();
    let out = "";

    if (data.answer && String(data.answer).trim()) {
      out += `Search overview: ${String(data.answer).trim()}\n\n`;
    }

    const results = Array.isArray(data.results) ? data.results : [];
    for (const r of results) {
      const title = (r.title || "Source").trim();
      const url = (r.url || "").trim();
      const snippet = String(r.content || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1400);
      if (!snippet && !url) continue;
      out += `[${title}](${url})\n${snippet}\n\n`;
      if (out.length >= MAX_WEB_CONTEXT_CHARS) break;
    }

    return out.slice(0, MAX_WEB_CONTEXT_CHARS).trim();
  } catch (e) {
    console.warn("Tavily search failed:", e?.message || e);
    return "";
  }
}
