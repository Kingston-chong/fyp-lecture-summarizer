import { convertPptxBufferToPdf } from "@/lib/pptxToPdf";
import { renderPdfPagesToPngBuffers } from "@/lib/renderPdfPages";

/**
 * PPTX → PDF → PNG per slide/page.
 * @param {Buffer} pptxBuffer
 * @param {{ maxPages?: number }} [opts]
 * @returns {Promise<Buffer[]>}
 */
export async function pptxBufferToSlidePngBuffers(pptxBuffer, opts = {}) {
  const result = await convertPptxBufferToPdf(pptxBuffer);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return renderPdfPagesToPngBuffers(result.buffer, opts);
}
