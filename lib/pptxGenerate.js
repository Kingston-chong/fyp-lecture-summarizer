/**
 * Build an improved .pptx with themed layout (cover, accent bars, content panel) and speaker notes.
 */
import pptxgen from "pptxgenjs";
import { mixHex, panelFromBackground } from "@/lib/themeColors";

const LAYOUT = "LAYOUT_16x9";

function hexNoHash(hex) {
  return String(hex || "").replace(/^#/, "").slice(0, 6) || "1e293b";
}

/**
 * @param {{
 *   title?: string;
 *   subtitle?: string;
 *   theme: {
 *     background: string;
 *     accent: string;
 *     text: string;
 *     panel?: string;
 *   };
 *   slides: {
 *     index: number;
 *     title?: string;
 *     lines: string[];
 *     notes?: string;
 *   }[];
 *   images?: { slideIndex: number; data: Buffer | ArrayBuffer }[];
 * }} opts
 * @returns {Promise<Buffer>}
 */
export async function buildImprovedPptx(opts) {
  const pptx = new pptxgen();
  pptx.layout = LAYOUT;
  pptx.author = "Slide2Notes";
  pptx.title = opts.title || "Improved presentation";

  const bg = hexNoHash(opts.theme.background);
  const accent = hexNoHash(opts.theme.accent);
  const textCol = hexNoHash(opts.theme.text);
  const panelHex =
    opts.theme.panel != null && String(opts.theme.panel).trim()
      ? hexNoHash(opts.theme.panel)
      : panelFromBackground(`#${bg}`, `#${accent}`);

  const imageBySlide = new Map();
  for (const im of opts.images || []) {
    if (!imageBySlide.has(im.slideIndex)) imageBySlide.set(im.slideIndex, im.data);
  }

  const deckTitle = String(opts.title || "Presentation").slice(0, 200);
  const deckSubtitle = String(opts.subtitle || "").slice(0, 280);
  const ST = pptx.ShapeType;

  const addCoverSlide = () => {
    const slide = pptx.addSlide();
    slide.background = { color: bg };

    slide.addShape(ST.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.42,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    });

    slide.addShape(ST.roundRect, {
      x: 0.55,
      y: 1.15,
      w: 8.9,
      h: 3.65,
      fill: { color: panelHex, transparency: 25 },
      line: { color: accent, width: 1 },
      rectRadius: 0.08,
    });

    slide.addText(deckTitle, {
      x: 0.85,
      y: 1.55,
      w: 8.3,
      h: 1.1,
      fontSize: 36,
      bold: true,
      color: accent,
      fontFace: "Arial",
      align: "center",
    });

    if (deckSubtitle) {
      slide.addText(deckSubtitle, {
        x: 0.85,
        y: 2.85,
        w: 8.3,
        h: 0.9,
        fontSize: 16,
        color: textCol,
        fontFace: "Arial",
        align: "center",
      });
    }

    slide.addText("Slide2Notes", {
      x: 0.5,
      y: 5.15,
      w: 3,
      h: 0.3,
      fontSize: 10,
      color: accent,
    });

    slide.addNotes(
      `Presentation: ${deckTitle}${deckSubtitle ? `\nOverview: ${deckSubtitle}` : ""}\n\nUse these slides with the speaker notes on each content slide for full context.`
    );
  };

  const addContentSlide = (s, slideNum, totalContent) => {
    const slide = pptx.addSlide();
    slide.background = { color: bg };

    slide.addShape(ST.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.28,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    });

    slide.addShape(ST.rect, {
      x: 0,
      y: 0.28,
      w: 0.12,
      h: 5.1,
      fill: { color: mixHex(`#${accent}`, `#${bg}`, 0.35) },
      line: { width: 0 },
    });

    slide.addShape(ST.roundRect, {
      x: 0.38,
      y: 0.52,
      w: 9.24,
      h: 4.72,
      fill: { color: panelHex, transparency: 20 },
      line: { color: accent, width: 0.75 },
      rectRadius: 0.06,
    });

    const hasImage = imageBySlide.has(s.index);
    const titleText = String(s.title || `Slide ${s.index}`).slice(0, 200);

    slide.addText(titleText, {
      x: hasImage ? 0.62 : 0.62,
      y: 0.68,
      w: hasImage ? 5.35 : 8.7,
      h: 0.52,
      fontSize: 22,
      bold: true,
      color: accent,
      fontFace: "Arial",
    });

    if (hasImage) {
      const buf = imageBySlide.get(s.index);
      const data =
        buf instanceof Buffer ? buf : Buffer.from(new Uint8Array(buf));
      slide.addImage({
        data,
        x: 6.05,
        y: 1.35,
        w: 3.35,
        h: 3.15,
        rounding: true,
        shadow: {
          type: "outer",
          color: "000000",
          blur: 6,
          offset: 3,
          angle: 270,
          opacity: 0.4,
        },
      });
    }

    const bulletBlocks = (s.lines || []).filter(Boolean).map((line) => ({
      text: String(line),
      options: {
        bullet: true,
        fontSize: 13.5,
        color: textCol,
        fontFace: "Arial",
        paraSpaceBefore: 2,
        paraSpaceAfter: 2,
      },
    }));

    const textLeft = 0.65;
    const textW = hasImage ? 5.15 : 8.75;
    const textTop = 1.32;
    const textH = hasImage ? 3.55 : 3.85;

    if (bulletBlocks.length > 0) {
      slide.addText(bulletBlocks, {
        x: textLeft,
        y: textTop,
        w: textW,
        h: textH,
        valign: "top",
        fit: "shrink",
      });
    } else {
      slide.addText("Add content in the generator step.", {
        x: textLeft,
        y: textTop,
        w: textW,
        h: 0.8,
        fontSize: 12,
        italic: true,
        color: textCol,
      });
    }

    slide.addText(`Slide2Notes  ·  ${slideNum} / ${totalContent}`, {
      x: 0.55,
      y: 5.12,
      w: 4.5,
      h: 0.28,
      fontSize: 9,
      color: accent,
    });

    const notes = String(s.notes || "").trim();
    if (notes) {
      slide.addNotes(notes.slice(0, 12000));
    } else {
      slide.addNotes(
        `Title: ${titleText}\n\nKey points:\n${(s.lines || []).slice(0, 12).join("\n• ")}`
      );
    }
  };

  const slides = opts.slides || [];
  const hasCover = Boolean(deckTitle);

  if (hasCover) {
    addCoverSlide();
  }

  const totalContent = slides.length;
  let num = 0;
  for (const s of slides) {
    num += 1;
    addContentSlide(s, num, totalContent);
  }

  if (!hasCover && totalContent === 0) {
    const slide = pptx.addSlide();
    slide.addText("No slides to display.", { x: 1, y: 2, w: 8, h: 1 });
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
