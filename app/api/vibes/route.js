import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { ALAI_BASE, alaiFetch, getAlaiApiKeys } from "@/lib/alaiClient";

export async function GET(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "alai";

    if (provider === "alai") {
      if (!getAlaiApiKeys().length) {
        return NextResponse.json({
          vibes: [],
          hint: "ALAI_API_KEY is not configured.",
        });
      }

      const { res, data } = await alaiFetch(`${ALAI_BASE}/vibes`, {
        method: "GET",
      });
      if (!res.ok) {
        return NextResponse.json(
          {
            vibes: [],
            error:
              data?.message ||
              data?.error ||
              `Alai vibes failed (${res.status})`,
          },
          { status: 502 },
        );
      }

      const vibes = Array.isArray(data?.vibes) ? data.vibes : [];
      return NextResponse.json({ vibes });
    }

    return NextResponse.json({ vibes: [] });
  } catch (err) {
    return NextResponse.json(
      { error: String(err?.message || err), vibes: [] },
      { status: 500 },
    );
  }
}
