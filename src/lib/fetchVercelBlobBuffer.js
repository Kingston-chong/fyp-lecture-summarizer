import { get } from "@vercel/blob";

/**
 * Download a private Vercel Blob object (plain fetch returns 403/HTML).
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export async function fetchVercelBlobBuffer(url) {
  const result = await get(String(url || ""), { access: "private", useCache: true });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Failed to fetch blob");
  }
  const res = new Response(result.stream);
  return Buffer.from(await res.arrayBuffer());
}
