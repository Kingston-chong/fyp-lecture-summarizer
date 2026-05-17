import { promisify } from "util";

/**
 * Convert PPTX bytes to PDF (LibreOffice locally, or optional Gotenberg service).
 * @param {Buffer} pptxBuffer
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function convertPptxBufferToPdf(pptxBuffer) {
  if (!pptxBuffer?.length) {
    return { ok: false, error: "Empty presentation file." };
  }

  const gotenberg = String(process.env.GOTENBERG_URL || "").trim();
  if (gotenberg) {
    try {
      const base = gotenberg.replace(/\/$/, "");
      const form = new FormData();
      form.append(
        "files",
        new Blob([pptxBuffer], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }),
        "presentation.pptx",
      );
      const res = await fetch(`${base}/forms/libreoffice/convert`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          error:
            text.slice(0, 240) ||
            `Gotenberg conversion failed (HTTP ${res.status}).`,
        };
      }
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);
      if (!buffer.length) {
        return { ok: false, error: "Gotenberg returned an empty PDF." };
      }
      return { ok: true, buffer };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
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
          "Install LibreOffice on this machine for local PDF conversion, or set GOTENBERG_URL (Docker). You can also enable Alai PDF export with a valid ALAI_API_KEY.",
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
