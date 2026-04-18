import { parsePptxToSlides } from "@/lib/pptxSlides";

export const MAX_SLIDE_TEXT = 4000;

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
