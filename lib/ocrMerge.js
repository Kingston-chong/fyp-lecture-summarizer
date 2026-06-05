const MAX_SLIDE_TEXT = 4000;
const PLACEHOLDER_RE = /^\(empty (slide|page)\)$/i;

/**
 * @param {{ text?: string; lines?: string[] }} slide
 */
export function slideNeedsOcr(slide) {
  const text = String(slide?.text || "").trim();
  if (PLACEHOLDER_RE.test(text)) return true;

  const lines = (slide?.lines || [])
    .map((l) => String(l).trim())
    .filter((l) => l && !PLACEHOLDER_RE.test(l));

  if (lines.length < 2) return true;

  const joined = lines.join(" ");
  return joined.length < 80;
}

/**
 * @param {string} haystack
 * @param {string} needle
 */
function lineAlreadyPresent(haystack, needle) {
  const n = needle.toLowerCase().trim();
  if (n.length < 4) return true;
  return haystack.includes(n);
}

/**
 * @param {{ index: number; text: string; lines: string[] }[]} slides
 * @param {Record<number, string>} ocrByIndex - 0-based slide array index → OCR text
 */
export function mergeOcrIntoSlides(slides, ocrByIndex) {
  return slides.map((slide, i) => {
    const ocr = String(ocrByIndex[i] || "").trim();
    if (!ocr) return slide;

    const existingText = [slide.text || "", ...(slide.lines || [])]
      .join(" ")
      .toLowerCase();

    const newLines = ocr
      .split(/\r?\n+/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l.length > 3 && !lineAlreadyPresent(existingText, l));

    if (newLines.length === 0) return slide;

    const lines = [...(slide.lines || []), ...newLines].slice(0, 40);
    const text = lines.join("\n").slice(0, MAX_SLIDE_TEXT);

    return {
      index: slide.index,
      text,
      lines: lines.map((l) => String(l).slice(0, 800)),
    };
  });
}
