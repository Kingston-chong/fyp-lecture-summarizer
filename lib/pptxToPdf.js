import { promisify } from "util";

/**
 * Convert PPTX bytes to PDF via LibreOffice (local install required).
 * @param {Buffer} pptxBuffer
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function convertPptxBufferToPdf(pptxBuffer) {
  if (!pptxBuffer?.length) {
    return { ok: false, error: "Empty presentation file." };
  }

  try {
    const libre = await import("libreoffice-convert");
    const convert =
      typeof libre.convertAsync === "function"
        ? libre.convertAsync
        : promisify(libre.default?.convert || libre.convert);
    const pdfBuf = await convert(pptxBuffer, ".pdf", undefined);
    const buffer = Buffer.isBuffer(pdfBuf) ? pdfBuf : Buffer.from(pdfBuf);
    if (!buffer.length) {
      return { ok: false, error: "Conversion produced an empty PDF." };
    }
    return { ok: true, buffer };
  } catch (err) {
    const msg = err?.message || String(err);
    if (/libreoffice|soffice|not found|ENOENT|spawn/i.test(msg)) {
      return {
        ok: false,
        error:
          "Install LibreOffice on this machine for PPTX→PDF conversion. For hosted deployments, use Alai slide generation (ALAI_API_KEY) for PDF export, or let users download PPTX only.",
      };
    }
    return { ok: false, error: msg };
  }
}

/** @param {ReadableStream<Uint8Array> | null | undefined} stream */
export async function readableStreamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  const ab = await new Response(stream).arrayBuffer();
  return Buffer.from(ab);
}
