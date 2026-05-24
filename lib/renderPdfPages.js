import path from "path";
import { pathToFileURL } from "url";
import { createCanvas } from "@napi-rs/canvas";
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";

GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  ),
).href;

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_SCALE = 1.5;

/**
 * Render PDF pages to PNG buffers (one per page, 1-based order).
 * @param {Buffer} pdfBuffer
 * @param {{ maxPages?: number; maxWidth?: number; scale?: number }} [opts]
 * @returns {Promise<Buffer[]>}
 */
export async function renderPdfPagesToPngBuffers(pdfBuffer, opts = {}) {
  const maxPages = Math.max(1, opts.maxPages ?? 50);
  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_WIDTH;
  const baseScale = opts.scale ?? DEFAULT_SCALE;

  const data = new Uint8Array(pdfBuffer);
  const doc = await getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: false,
    verbosity: 0,
  }).promise;

  const pageCount = Math.min(doc.numPages, maxPages);
  const buffers = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport1 = page.getViewport({ scale: 1 });
    const scale =
      viewport1.width > maxWidth
        ? (maxWidth / viewport1.width) * baseScale
        : baseScale;
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    await page.render({
      canvasContext: /** @type {CanvasRenderingContext2D} */ (ctx),
      viewport,
    }).promise;

    buffers.push(canvas.toBuffer("image/png"));
    page.cleanup();
  }

  await doc.destroy();
  return buffers;
}
