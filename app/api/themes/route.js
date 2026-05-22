import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { ALAI_BASE, getAlaiApiKey } from "@/lib/alaiClient";

export async function GET(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "alai";

    if (provider === "alai") {
      const alaiKey = getAlaiApiKey();
      if (!alaiKey) {
        return NextResponse.json({
          themes: [],
          hint: "ALAI_API_KEY is not configured.",
        });
      }

      const res = await fetch(`${ALAI_BASE}/themes`, {
        headers: { Authorization: `Bearer ${alaiKey}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          {
            themes: [],
            error:
              data?.message ||
              data?.error ||
              `Alai themes failed (${res.status})`,
          },
          { status: 502 },
        );
      }

      const themes = Array.isArray(data?.themes) ? data.themes : [];
      return NextResponse.json({ themes });
    }

    if (provider === "2slides") {
      if (!process.env.TWOSLIDES_API_KEY) {
        return NextResponse.json({
          themes: [],
          hint: "TWOSLIDES_API_KEY is not configured.",
        });
      }

      const query = String(url.searchParams.get("query") || "business").trim();
      const limitRaw = Number.parseInt(
        url.searchParams.get("limit") || "20",
        10,
      );
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(limitRaw, 100)
          : 20;

      const searchUrl = new URL("https://2slides.com/api/v1/themes/search");
      searchUrl.searchParams.set("query", query || "business");
      searchUrl.searchParams.set("limit", String(limit));

      const res = await fetch(searchUrl.toString(), {
        headers: {
          Authorization: `Bearer ${process.env.TWOSLIDES_API_KEY}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          {
            themes: [],
            error:
              data?.message ||
              data?.error ||
              `2slides theme search failed (${res.status})`,
          },
          { status: 502 },
        );
      }

      const raw = Array.isArray(data?.data?.themes) ? data.data.themes : [];
      const themes = raw.map((t) => ({
        id: String(t.id || ""),
        name: String(t.name || ""),
        description: String(t.description || ""),
        tags: Array.isArray(t.tags) ? t.tags.join(", ") : String(t.tags || ""),
        themeURL: String(t.themeURL || ""),
      }));

      return NextResponse.json({ themes });
    }

    return NextResponse.json({ themes: [] });
  } catch (err) {
    return NextResponse.json(
      { error: String(err?.message || err), themes: [] },
      { status: 500 },
    );
  }
}
