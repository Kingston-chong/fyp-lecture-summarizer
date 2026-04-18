/**
 * Parse a .pptx buffer into structured slide text (DrawingML a:t nodes per slide).
 * Legacy .ppt is not supported.
 *
 * Future (in-place improve): the Improve PPT flow currently rebuilds a new deck via
 * pptxgen from extracted text. To preserve the user’s original masters/layouts and
 * only inject images or append notes, you would keep the uploaded .pptx binary and
 * patch OOXML (e.g. JSZip: ppt/slides/slideN.xml, ppt/media, relationships) instead
 * of regenerating slides from scratch.
 */

const MAX_SLIDES = 50;

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ slides: { index: number; text: string; lines: string[] }[]; title?: string }>}
 */
export async function parsePptxToSlides(buffer) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const slidePaths = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      const nb = Number.parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      return na - nb;
    });

  if (slidePaths.length === 0) {
    throw new Error("No slides found in this file. Use a valid .pptx file.");
  }

  const limited = slidePaths.slice(0, MAX_SLIDES);
  const slides = [];

  for (const path of limited) {
    const xml = await zip.files[path].async("string");
    const texts = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const t = decodeXmlEntities(m[1]).trim();
      if (t) texts.push(t);
    }
    const slideText = texts.join("\n").trim() || "(empty slide)";
    slides.push({
      index: slides.length + 1,
      text: slideText,
      lines: texts.length ? texts : [slideText],
    });
  }

  return { slides };
}

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export { MAX_SLIDES };
