/**
 * Optional Unsplash search for stock images (requires UNSPLASH_ACCESS_KEY in env).
 * @param {string} query
 * @returns {Promise<string|null>} image URL suitable for fetch, or null
 */
export async function fetchUnsplashImageUrl(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !String(query).trim()) return null;

  const q = encodeURIComponent(String(query).trim().slice(0, 120));
  const url = `https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const first = data?.results?.[0];
  const u = first?.urls?.small || first?.urls?.regular;
  return u || null;
}
