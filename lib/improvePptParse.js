import { parsePptxToSlides } from "@/lib/pptxSlides";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_SLIDE_TEXT = 4000;
export const MAX_IMPROVE_PDF_PAGES = 50;

/**
 * @param {{ index: number; text: string; lines: string[] }[]} slides
 */
export function truncateSlides(slides) {
  return slides.map((s) => ({
    index: s.index,
    text: String(s.text || "").slice(0, MAX_SLIDE_TEXT),
    lines: (s.lines || []).map((l) => String(l).slice(0, 800)).slice(0, 40),
  }));
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ index: number; text: string; lines: string[] }[]>}
 */
export async function parsePptxBufferToSlides(buffer) {
  const { slides: rawSlides } = await parsePptxToSlides(buffer);
  return truncateSlides(rawSlides);
}

/**
 * One PDF page → one “slide” for the improve-ppt pipeline.
 * @param {Buffer} buffer
 * @returns {Promise<{ index: number; text: string; lines: string[] }[]>}
 */
export async function parsePdfBufferToSlides(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [];
  const n = Math.min(
    pages.length,
    Number.isFinite(totalPages) ? totalPages : pages.length,
    MAX_IMPROVE_PDF_PAGES,
  );
  const slides = [];
  for (let i = 0; i < n; i++) {
    const pageStr = String(pages[i] ?? "");
    const raw = pageStr.replace(/\s+/g, " ").trim();
    const lines = pageStr
      .split(/\r?\n+/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 40);
    const slideText = raw || "(empty page)";
    slides.push({
      index: i + 1,
      text: slideText,
      lines: lines.length ? lines : [slideText],
    });
  }
  return truncateSlides(slides);
}
