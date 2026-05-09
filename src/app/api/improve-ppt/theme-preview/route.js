import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";

/**
 * GET /api/improve-ppt/theme-preview?url=<encoded-themeURL>
 *
 * The 2slides API does not return preview images directly. Instead, each theme
 * has a `themeURL` pointing to its page on 2slides.com (e.g.
 * https://2slides.com/templates/dark-green-modern-...). Those pages include an
 * og:image meta tag that contains the actual thumbnail.
 *
 * This route:
 *   1. Fetches the theme page HTML (server-side, so CORS is not an issue)
 *   2. Extracts the og:image URL
 *   3. Fetches the image and streams it back to the browser
 *
 * Results are cached in memory for 10 minutes to avoid hammering 2slides on
 * every render.
 */

// ── In-memory cache: themeURL → { imageUrl, fetchedAt } ──────────────────────
const ogCache = new Map(); // themeURL -> { imageUrl: string|null, fetchedAt: number }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function resolveOgImage(themeUrl) {
  const now = Date.now();
  const cached = ogCache.get(themeUrl);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.imageUrl;
  }

  try {
    const res = await fetch(themeUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ThemePreviewBot/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      ogCache.set(themeUrl, { imageUrl: null, fetchedAt: now });
      return null;
    }

    const html = await res.text();

    // Extract og:image — handle both property="og:image" and name="og:image"
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    const imageUrl = match ? match[1] : null;
    ogCache.set(themeUrl, { imageUrl, fetchedAt: now });
    return imageUrl;
  } catch {
    ogCache.set(themeUrl, { imageUrl: null, fetchedAt: now });
    return null;
  }
}

// ── Allowed hosts — only proxy images from 2slides ───────────────────────────
const ALLOWED_IMAGE_HOSTS = ["2slides.com", "www.2slides.com"];

function isSafeImageUrl(raw) {
  try {
    const { protocol, hostname } = new URL(raw);
    return (
      (protocol === "https:" || protocol === "http:") &&
      ALLOWED_IMAGE_HOSTS.some(
        (h) => hostname === h || hostname.endsWith(`.${h}`)
      )
    );
  } catch {
    return false;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req) {
  try {
    const user = await getRequestUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const themeUrl = String(searchParams.get("url") || "").trim();

    if (!themeUrl || !isSafeImageUrl(themeUrl)) {
      return NextResponse.json(
        { error: "Missing or invalid theme URL" },
        { status: 400 }
      );
    }

    // Step 1: resolve og:image from the theme page
    const imageUrl = await resolveOgImage(themeUrl);

    if (!imageUrl || !isSafeImageUrl(imageUrl)) {
      return NextResponse.json(
        { error: "No preview image found for this theme" },
        { status: 404 }
      );
    }

    // Step 2: proxy the image
    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ThemePreviewBot/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!imgRes.ok) {
      return NextResponse.json(
        { error: `Image fetch failed (${imgRes.status})` },
        { status: imgRes.status }
      );
    }

    const contentType = imgRes.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Resolved URL is not an image" },
        { status: 502 }
      );
    }

    const data = Buffer.from(await imgRes.arrayBuffer());
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache in browser for 10 min, CDN for 1 hour
        "Cache-Control": "public, max-age=600, s-maxage=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}