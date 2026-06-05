import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { getClientIp } from "@/lib/rateLimit";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { fetchTavilySourcesForWebSources } from "@/lib/tavilySearch";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const user = await getRequestUser();
    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || "").trim();

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Web search is not configured. Set TAVILY_API_KEY or paste a website URL instead.",
        },
        { status: 503 },
      );
    }

    if (!user) {
      const ip = getClientIp(req);
      const rateLimited = await applyLlmRateLimit(
        "sources-web-search-guest",
        `ip:${ip}`,
      );
      if (rateLimited) return rateLimited;
    }

    const { answer, sources } = await fetchTavilySourcesForWebSources(query);
    return NextResponse.json({
      query,
      answer: answer || null,
      results: (sources || []).map((s) => ({
        title: s.title,
        url: s.url,
        snippet: s.snippet,
        domain: s.domain,
      })),
    });
  } catch (err) {
    console.error("sources/web-search:", err);
    return NextResponse.json(
      { error: err?.message || "Web search failed" },
      { status: 500 },
    );
  }
}
