import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { fetchUnsplashSearchResults } from "@/lib/unsplashStock";

const MAX_Q = 200;

function imageSearchProvider() {
  if (process.env.UNSPLASH_ACCESS_KEY) return "unsplash";
  return "none";
}

/**
 * GET ?q= — image search for Improve PPT.
 * Uses Unsplash search only (UNSPLASH_ACCESS_KEY).
 *
 * Omit q (or q empty) to discover which provider is active without running a search.
 */
export async function GET(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const qRaw = String(searchParams.get("q") ?? "").trim();
    const provider = imageSearchProvider();

    if (!qRaw) {
      const hint =
        provider === "none"
          ? "Image search is not configured. Set UNSPLASH_ACCESS_KEY."
          : "Using Unsplash for images.";
      return NextResponse.json({ items: [], hint, provider });
    }

    const q = qRaw.slice(0, MAX_Q);

    if (provider === "unsplash") {
      const items = await fetchUnsplashSearchResults(q, 10);
      const hint =
        items.length === 0
          ? "No Unsplash results. Try another query."
          : "Using Unsplash.";

      return NextResponse.json({ items, provider, hint });
    }

    return NextResponse.json({
      items: [],
      provider: "none",
      hint: "Image search is not configured. Set UNSPLASH_ACCESS_KEY.",
    });
  } catch (err) {
    console.error("improve-ppt image-search:", err);
    return NextResponse.json(
      { error: String(err?.message || err), items: [], provider: "none" },
      { status: 500 },
    );
  }
}
