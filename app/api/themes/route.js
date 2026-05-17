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

    return NextResponse.json({ themes: [] });
  } catch (err) {
    return NextResponse.json(
      { error: String(err?.message || err), themes: [] },
      { status: 500 },
    );
  }
}
