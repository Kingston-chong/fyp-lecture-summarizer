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
/** @param {unknown} node */
function pickUrl(node) {
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
}

export function extractPptxUrlFromAlaiGenerationJson(data) {
  if (!data || typeof data !== "object") return null;

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

  u = pickUrl(formats.link) || pickUrl(formats.viewer) || pickUrl(formats.pdf);
  if (u && /\.pptx?(\?|$)/i.test(u)) return u;

  for (const k of [
    "download_url",
    "downloadUrl",
    "ppt_url",
    "pptx_url",
    "file_url",
  ]) {
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
 * Best-effort PDF URL from Alai `GET /generations/:id` JSON.
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {string|null}
 */
export function extractPdfUrlFromAlaiGenerationJson(data) {
  if (!data || typeof data !== "object") return null;

  const formats =
    data.formats && typeof data.formats === "object"
      ? /** @type {Record<string, unknown>} */ (data.formats)
      : {};

  let u = pickUrl(formats.pdf);
  if (u && /\.pdf(\?|$)/i.test(u)) return u;

  for (const k of ["pdf_url", "pdfUrl"]) {
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
      if (url && fmt.includes("pdf")) return url;
    }
  }

  u = pickUrl(formats.pdf);
  return u && /\.pdf(\?|$)/i.test(u) ? u : null;
}

/**
 * Fetch completed Alai generation JSON and resolve the PPTX export URL.
 * Retries a few times when status is `completed` but the export URL is not yet present.
 *
 * @param {string} generationId
 * @returns {Promise<{ ok: true, pptUrl: string, status: string } | { ok: false, error: string, status?: number }>}
 */
export async function getAlaiPptxUrl(generationId) {
  return getAlaiPptxUrlWithPoll(generationId);
}

/**
 * Poll Alai until `status === completed` and a PPT export URL is present.
 *
 * @param {string} generationId
 * @param {{
 *   maxAttempts?: number;
 *   pollIntervalMs?: number;
 * }} [opts]
 * @returns {Promise<{ ok: true, pptUrl: string, status: string } | { ok: false, error: string, status?: number }>}
 */
export async function getAlaiPptxUrlWithPoll(generationId, opts = {}) {
  if (!process.env.ALAI_API_KEY) {
    return { ok: false, error: "ALAI_API_KEY is not configured." };
  }

  const maxAttempts =
    Number.isFinite(opts.maxAttempts) && opts.maxAttempts > 0
      ? Math.floor(opts.maxAttempts)
      : 6;
  const pollIntervalMs =
    Number.isFinite(opts.pollIntervalMs) && opts.pollIntervalMs >= 0
      ? opts.pollIntervalMs
      : 450;

  let lastErr = "PPT export URL not available from Alai yet.";
  let lastStatusCode = /** @type {number|undefined} */ (undefined);
  let lastGenStatus = /** @type {string|undefined} */ (undefined);

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
    lastStatusCode = res.status;

    if (!res.ok) {
      return {
        ok: false,
        error:
          data?.error || data?.message || "Failed to fetch Alai generation",
        status: res.status,
      };
    }

    const genStatus = String(data?.status || "").toLowerCase();
    lastGenStatus = genStatus || undefined;

    if (genStatus === "failed") {
      return {
        ok: false,
        error: String(data?.error || "Generation failed at Alai."),
        status: 502,
      };
    }

    if (genStatus === "completed") {
      const pptUrl = extractPptxUrlFromAlaiGenerationJson(data);
      if (pptUrl) {
        return { ok: true, pptUrl, status: genStatus };
      }
      lastErr = "Alai completed but PPT export URL is not available yet.";
    } else {
      lastErr = `Not ready (status: ${genStatus || "unknown"})`;
    }

    if (attempt < maxAttempts - 1 && pollIntervalMs > 0) {
      await sleep(pollIntervalMs);
    }
  }

  return {
    ok: false,
    error: lastErr,
    status: lastStatusCode,
    genStatus: lastGenStatus,
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

/**
 * @param {string} generationId
 * @returns {Promise<{ ok: true, pdfUrl: string } | { ok: false, error: string, status?: number }>}
 */
export async function getAlaiPdfUrl(generationId) {
  if (!process.env.ALAI_API_KEY) {
    return { ok: false, error: "ALAI_API_KEY is not configured." };
  }

  const res = await fetch(
    `https://slides-api.getalai.com/api/v1/generations/${generationId}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.ALAI_API_KEY}` },
      cache: "no-store",
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data?.error || data?.message || "Failed to fetch Alai generation",
      status: res.status,
    };
  }

  const genStatus = String(data?.status || "").toLowerCase();
  if (genStatus !== "completed") {
    return { ok: false, error: "Slide generation is not completed yet." };
  }

  const pdfUrl = extractPdfUrlFromAlaiGenerationJson(data);
  if (!pdfUrl) {
    return {
      ok: false,
      error:
        "PDF export is not available for this deck. Regenerate slides to create a PDF copy.",
    };
  }
  return { ok: true, pdfUrl };
}

/**
 * @param {string} pdfUrl
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function downloadPdfBuffer(pdfUrl) {
  const fileRes = await fetch(pdfUrl, { cache: "no-store" });
  if (!fileRes.ok) {
    return { ok: false, error: "Failed to download PDF from upstream." };
  }
  const ab = await fileRes.arrayBuffer();
  return { ok: true, buffer: Buffer.from(ab) };
}
