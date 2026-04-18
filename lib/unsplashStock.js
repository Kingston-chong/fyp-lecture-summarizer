/**
 * Optional Unsplash search for stock images (requires UNSPLASH_ACCESS_KEY in env).
 * @param {string} query
 * @returns {Promise<string|null>} image URL suitable for fetch, or null
 */
export async function fetchUnsplashImageUrl(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !String(query).trim()) return null;

  const q = encodeURIComponent(String(query).trim().slice(0, 120));
  const url = `https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=landscape&content_filter=high`;

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const first = data?.results?.[0];
  const u = first?.urls?.small || first?.urls?.regular;
  return u || null;
}

/**
 * Multiple image results for Improve PPT search UI (same API key as single fetch).
 * @param {string} query
 * @param {number} perPage max 15
 * @returns {Promise<{ title: string; link: string; thumbnailLink: string; width?: number; height?: number }[]>}
 */
export async function fetchUnsplashSearchResults(query, perPage = 10) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !String(query).trim()) return [];

  const n = Math.min(15, Math.max(1, Number(perPage) || 10));
  const q = encodeURIComponent(String(query).trim().slice(0, 120));
  const url = `https://api.unsplash.com/search/photos?query=${q}&per_page=${n}&orientation=landscape&content_filter=high`;

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r) => ({
    title: String(r?.description || r?.alt_description || query).slice(0, 200),
    link: String(r?.urls?.regular || r?.urls?.small || "").trim(),
    thumbnailLink: String(r?.urls?.small || r?.urls?.thumb || r?.urls?.regular || "").trim(),
    width: r?.width,
    height: r?.height,
  })).filter((x) => x.link.startsWith("http"));
}