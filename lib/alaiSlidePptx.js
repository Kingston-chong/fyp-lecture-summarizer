/**
 * Fetch completed Alai generation JSON and resolve the PPTX export URL.
 * @param {string} generationId
 * @returns {Promise<{ ok: true, pptUrl: string, status: string } | { ok: false, error: string, status?: number }>}
 */
export async function getAlaiPptxUrl(generationId) {
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
    return { ok: false, error: `Not ready (status: ${genStatus || "unknown"})` };
  }
  const formats = data?.formats && typeof data.formats === "object" ? data.formats : {};
  const pptUrl =
    formats?.ppt?.url ||
    formats?.pptx?.url ||
    formats?.presentation?.url ||
    data?.download_url ||
    data?.downloadUrl ||
    data?.ppt_url ||
    data?.pptx_url ||
    null;
  if (!pptUrl) {
    return { ok: false, error: "PPT export URL not available from Alai." };
  }
  return { ok: true, pptUrl, status: genStatus };
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
