import { ocrSlideImage } from "@/lib/ocrSlide";
import { mergeOcrIntoSlides, slideNeedsOcr } from "@/lib/ocrMerge";
import { pptxBufferToSlidePngBuffers } from "@/lib/ocrPptxSlides";
import { renderPdfPagesToPngBuffers } from "@/lib/renderPdfPages";
import { MAX_IMPROVE_PDF_PAGES } from "@/lib/improvePptParse";
import { MAX_SLIDES } from "@/lib/pptxSlides";

export const OCR_MAX_VISION_CALLS = 20;
export const OCR_CONCURRENCY = 3;

/**
 * @param {number} concurrency
 */
function createLimiter(concurrency) {
  let active = 0;
  /** @type {{ fn: () => Promise<unknown>; resolve: (v: unknown) => void; reject: (e: unknown) => void }[]} */
  const queue = [];

  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    Promise.resolve()
      .then(job.fn)
      .then(job.resolve, job.reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

/**
 * @param {{ index: number; text: string; lines: string[] }[]} slides
 * @param {Buffer} buffer
 * @param {{ isPdf: boolean; modelKey: string; modelVariant?: string | null }} opts
 * @returns {Promise<{ slides: typeof slides; ocrApplied: number; ocrWarning?: string }>}
 */
export async function enrichSlidesWithOcr(slides, buffer, opts) {
  const { isPdf, modelKey, modelVariant = null } = opts;

  if (modelKey === "deepseek") {
    return {
      slides,
      ocrApplied: 0,
      ocrWarning:
        "DeepSeek cannot read slide images. Switch to ChatGPT or Gemini for OCR.",
    };
  }

  const indices = slides
    .map((s, i) => (slideNeedsOcr(s) ? i : -1))
    .filter((i) => i >= 0)
    .slice(0, OCR_MAX_VISION_CALLS);

  if (indices.length === 0) {
    return { slides, ocrApplied: 0 };
  }

  const maxPages = Math.min(
    slides.length,
    isPdf ? MAX_IMPROVE_PDF_PAGES : MAX_SLIDES,
  );

  let pngBuffers;
  try {
    pngBuffers = isPdf
      ? await renderPdfPagesToPngBuffers(buffer, { maxPages })
      : await pptxBufferToSlidePngBuffers(buffer, { maxPages });
  } catch (err) {
    console.warn("OCR render failed:", err?.message || err);
    return {
      slides,
      ocrApplied: 0,
      ocrWarning: String(err?.message || err),
    };
  }

  const limit = createLimiter(OCR_CONCURRENCY);
  /** @type {Record<number, string>} */
  const ocrByIndex = {};
  let ocrApplied = 0;

  await Promise.all(
    indices.map((slideIndex) =>
      limit(async () => {
        const png = pngBuffers[slideIndex];
        if (!png?.length) return;
        try {
          const text = await ocrSlideImage(modelKey, modelVariant, png);
          if (text) {
            ocrByIndex[slideIndex] = text;
            ocrApplied += 1;
          }
        } catch (err) {
          console.warn(
            `OCR vision failed slide ${slideIndex + 1}:`,
            err?.message || err,
          );
        }
      }),
    ),
  );

  const enriched = mergeOcrIntoSlides(slides, ocrByIndex);
  return { slides: enriched, ocrApplied };
}
