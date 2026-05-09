/**
 * Fetch image bytes from a URL for server-side embedding (e.g. Improve PPT).
 * Many CDNs and Google image results use http, nonstandard Content-Types (image/jpg),
 * or omit types — this normalizes protocol, sends a browser-like User-Agent, and
 * falls back to magic-byte sniffing.
 */

const IMAGE_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_DEFAULT_BYTES = 6 * 1024 * 1024;

function sniffImageMagic(buf) {
  if (!buf || buf.length < 12) return false;
  const u = buf instanceof Buffer ? buf : Buffer.from(buf);
  if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return true;
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return true;
  if (u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return true;
  if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46) return true;
  return false;
}

function contentTypeLooksLikeImage(ct, buf) {
  const base = (ct || "").split(";")[0].trim().toLowerCase();
  if (!base) return sniffImageMagic(buf);
  if (/^image\/(jpeg|jpg|png|gif|webp|pjpeg|x-png|bmp)$/i.test(base)) return true;
  if (base === "application/octet-stream") return sniffImageMagic(buf);
  return false;
}

/** @param {string} url */
function candidateUrls(url) {
  const s = String(url || "").trim();
  if (!/^https?:\/\//i.test(s)) return [];
  const out = [s];
  if (s.startsWith("http://")) out.push(`https://${s.slice(7)}`);
  else if (s.startsWith("https://")) out.push(`http://${s.slice(8)}`);
  return [...new Set(out)];
}

/**
 * @param {string} url
 * @param {number} [maxBytes]
 * @returns {Promise<Buffer | null>}
 */
export async function fetchRemoteImageBuffer(url, maxBytes = MAX_DEFAULT_BYTES) {
  const tries = candidateUrls(url);
  if (tries.length === 0) return null;

  for (const tryUrl of tries) {
    try {
      const res = await fetch(tryUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        headers: {
          "User-Agent": IMAGE_FETCH_UA,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
      const ab = await res.arrayBuffer();
      if (ab.byteLength > maxBytes) continue;
      const buf = Buffer.from(ab);
      if (contentTypeLooksLikeImage(ct, buf) || sniffImageMagic(buf)) {
        if (/^image\/svg/i.test(ct)) continue;
        return buf;
      }
    } catch {
      /* try next URL */
    }
  }
  return null;
}
