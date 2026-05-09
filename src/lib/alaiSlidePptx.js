/**
 * Alai slide generation → PPTX URL resolution and download helpers.
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Best-effort PPTX URL from Alai `GET /generations/:id` JSON (shape varies by API version).
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {string|null}
 */
export function extractPptxUrlFromAlaiGenerationJson(data) {
  if (!data || typeof data !== "object") return null;

  /** @param {unknown} node */
  const pickUrl = (node) => {
    if (!node) return null;
    if (typeof node === "string" && /^https?:\/\//i.test(node)) return node;
    if (typeof node !== "object") return null;
    for (const k of [
      "url",
      "download_url",
      "downloadUrl",
      "href",
      "file_url",
      "fileUrl",
      "signed_url",
      "signedUrl",
      "link",
    ]) {
      const v = /** @type {Record<string, unknown>} */ (node)[k];
      if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
    }
    return null;
  };

  const formats =
    data.formats && typeof data.formats === "object"
      ? /** @type {Record<string, unknown>} */ (data.formats)
      : {};

  /** Prefer real PPT/PPTX exports; `link` is often a web viewer, use only as fallback. */
  let u =
    pickUrl(formats.ppt) ||
    pickUrl(formats.pptx) ||
    pickUrl(formats.presentation) ||
    pickUrl(formats.powerpoint) ||
    pickUrl(data.ppt) ||
    pickUrl(data.pptx);
  if (u) return u;

  for (const k of ["slides", "export", "file", "download"]) {
    u = pickUrl(/** @type {Record<string, unknown>} */ (formats)[k]);
    if (u && /\.pptx?(\?|$)/i.test(u)) return u;
  }

  u =
    pickUrl(formats.link) ||
    pickUrl(formats.viewer) ||
    pickUrl(formats.pdf);
  if (u && /\.pptx?(\?|$)/i.test(u)) return u;

  for (const k of ["download_url", "downloadUrl", "ppt_url", "pptx_url", "file_url"]) {
    const v = data[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
  }

  const lists = [data.exports, data.output_formats, data.files, data.outputs];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const ex of list) {
      if (!ex || typeof ex !== "object") continue;
      const fmt = String(
        /** @type {Record<string, unknown>} */ (ex).format ||
          /** @type {Record<string, unknown>} */ (ex).type ||
          "",
      ).toLowerCase();
      const url = pickUrl(ex);
      if (
        url &&
        (fmt.includes("ppt") ||
          fmt.includes("presentation") ||
          fmt.includes("slide") ||
          !fmt)
      ) {
        return url;
      }
    }
  }

  return null;
}

/**
 * Fetch completed Alai generation JSON and resolve the PPTX export URL.
 * Retries a few times when status is `completed` but the export URL is not yet present.
 *
 * @param {string} generationId
 * @returns {Promise<{ ok: true, pptUrl: string, status: string } | { ok: false, error: string, status?: number }>}
 */
export async function getAlaiPptxUrl(generationId) {
  if (!process.env.ALAI_API_KEY) {
    return { ok: false, error: "ALAI_API_KEY is not configured." };
  }

  const maxAttempts = 6;
  const delayMs = 450;
  let lastErr = "PPT export URL not available from Alai yet.";
  let lastStatus = /** @type {number|undefined} */ (undefined);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `https://slides-api.getalai.com/api/v1/generations/${generationId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.ALAI_API_KEY}` },
        cache: "no-store",
      },
    );
    const data = await res.json().catch(() => ({}));
    lastStatus = res.status;

    if (!res.ok) {
      return {
        ok: false,
        error: data?.error || data?.message || "Failed to fetch Alai generation",
        status: res.status,
      };
    }

    const genStatus = String(data?.status || "").toLowerCase();
    if (genStatus === "failed") {
      return {
        ok: false,
        error: String(data?.error || "Generation failed at Alai."),
        status: 502,
      };
    }

    if (genStatus !== "completed") {
      return {
        ok: false,
        error: `Not ready (status: ${genStatus || "unknown"})`,
      };
    }

    const pptUrl = extractPptxUrlFromAlaiGenerationJson(data);
    if (pptUrl) {
      return { ok: true, pptUrl, status: genStatus };
    }

    if (attempt < maxAttempts - 1) await sleep(delayMs);
  }

  return {
    ok: false,
    error: lastErr,
    status: lastStatus,
  };
}

/**
 * Download PPTX bytes from Alai signed URL.
 * @param {string} pptUrl
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function downloadPptxBuffer(pptUrl) {
  const fileRes = await fetch(pptUrl, { cache: "no-store" });
  if (!fileRes.ok) {
    return { ok: false, error: "Failed to download PPTX from upstream." };
  }
  const ab = await fileRes.arrayBuffer();
  return { ok: true, buffer: Buffer.from(ab) };
}
