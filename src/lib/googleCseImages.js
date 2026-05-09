/**
 * Google Custom Search JSON API — image search (shared by improve-ppt routes).
 */

/**
 * @param {string} q
 * @param {number} num 1–10 for free tier
 * @returns {Promise<{ ok: boolean; items: { title: string; link: string; thumbnailLink: string; width?: number; height?: number; source: string }[]; errorMessage?: string }>}
 */
export async function googleCseImageSearch(q, num = 10) {
  const googleKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  const query = String(q || "").trim();
  if (!googleKey || !cx || !query) {
    return { ok: false, items: [], errorMessage: null };
  }

  const n = Math.min(10, Math.max(1, Number(num) || 10));
  const u = new URL("https://www.googleapis.com/customsearch/v1");
  u.searchParams.set("key", googleKey);
  u.searchParams.set("cx", cx);
  u.searchParams.set("q", query);
  u.searchParams.set("searchType", "image");
  u.searchParams.set("num", String(n));
  u.searchParams.set("safe", "active");

  const res = await fetch(u.toString(), { next: { revalidate: 0 } });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      items: [],
      errorMessage: data?.error?.message || "Google image search failed",
    };
  }

  const raw = Array.isArray(data?.items) ? data.items : [];
  const items = raw
    .map((it) => {
      const link = String(it?.link || "").trim();
      const thumb =
        String(it?.image?.thumbnailLink || it?.link || "").trim() || link;
      const title = String(it?.title || q).slice(0, 200);
      if (!link.startsWith("http")) return null;
      return {
        title,
        link,
        thumbnailLink: thumb.startsWith("http") ? thumb : link,
        width: it?.image?.width,
        height: it?.image?.height,
        source: "google",
      };
    })
    .filter(Boolean);

  return { ok: true, items };
}

/**
 * @param {string} q
 * @returns {Promise<string | null>}
 */
export async function googleCseFirstImageUrl(q) {
  const { ok, items } = await googleCseImageSearch(q, 1);
  if (!ok || !items.length) return null;
  const link = String(items[0]?.link || "").trim();
  return link.startsWith("http") ? link : null;
}
