/**
 * Build an improved .pptx with themed layout (cover, accent bars, content panel),
 * speaker notes, correct image corner placement, and optional references slide.
 */
import pptxgen from "pptxgenjs";
import { mixHex, panelFromBackground } from "@/lib/themeColors";

const LAYOUT = "LAYOUT_16x9";
// Slide canvas: 10 × 5.625 inches (pptxgenjs default 16:9)
const SLIDE_W = 10;
const SLIDE_H = 5.625;

// Image thumbnail dimensions — top-right corner
const IMG_W = 2.6;
const IMG_H = 1.75; // ~3:2 landscape
const IMG_MARGIN = 0.18; // gap from slide edge

function hexNoHash(hex) {
  return String(hex || "").replace(/^#/, "").slice(0, 6) || "1e293b";
}

function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return null;
}

function toPptxImageData(bufOrAb) {
  const buf =
    bufOrAb instanceof Buffer ? bufOrAb : Buffer.from(new Uint8Array(bufOrAb));
  const mime = sniffImageMime(buf);
  if (!mime) return null;
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * @param {{\
 *   title?: string;\
 *   subtitle?: string;\
 *   theme: { background: string; accent: string; text: string; panel?: string };\
 *   slides: { index: number; title?: string; lines: string[]; notes?: string }[];\
 *   images?: { slideIndex: number; data: Buffer | ArrayBuffer }[];\
 *   skipCoverSlide?: boolean;\
 *   references?: { title: string; url: string }[];\
 * }} opts
 * @returns {Promise<Buffer>}
 */
export async function buildImprovedPptx(opts) {
  const pptx = new pptxgen();
  pptx.layout = LAYOUT;
  pptx.author = "Slide2Notes";
  pptx.title = opts.title || "Improved presentation";

  const bg      = hexNoHash(opts.theme.background);
  const accent  = hexNoHash(opts.theme.accent);
  const textCol = hexNoHash(opts.theme.text);
  const panelHex =
    opts.theme.panel != null && String(opts.theme.panel).trim()
      ? hexNoHash(opts.theme.panel)
      : panelFromBackground(`#${bg}`, `#${accent}`);

  const imageBySlide = new Map();
  for (const im of opts.images || []) {
    if (!imageBySlide.has(im.slideIndex)) imageBySlide.set(im.slideIndex, im.data);
  }

  const deckTitle    = String(opts.title    || "Presentation").slice(0, 200);
  const deckSubtitle = String(opts.subtitle || "").slice(0, 280);
  const ST = pptx.ShapeType;

  // ── Cover slide ────────────────────────────────────────────────────────────
  const addCoverSlide = () => {
    const slide = pptx.addSlide();
    slide.background = { color: bg };

    // Top accent bar
    slide.addShape(ST.rect, {
      x: 0, y: 0, w: SLIDE_W, h: 0.42,
      fill: { color: accent }, line: { color: accent, width: 0 },
    });

    // Central panel
    slide.addShape(ST.roundRect, {
      x: 0.55, y: 1.15, w: 8.9, h: 3.65,
      fill: { color: panelHex, transparency: 25 },
      line: { color: accent, width: 1 },
      rectRadius: 0.08,
    });

    slide.addText(deckTitle, {
      x: 0.85, y: 1.55, w: 8.3, h: 1.1,
      fontSize: 36, bold: true, color: accent,
      fontFace: "Calibri", align: "center",
    });

    if (deckSubtitle) {
      slide.addText(deckSubtitle, {
        x: 0.85, y: 2.85, w: 8.3, h: 0.9,
        fontSize: 16, color: textCol,
        fontFace: "Calibri", align: "center",
      });
    }

    slide.addText("Slide2Notes", {
      x: 0.5, y: SLIDE_H - 0.42, w: 3, h: 0.3,
      fontSize: 10, color: accent,
    });

    slide.addNotes(
      `Presentation: ${deckTitle}${deckSubtitle ? `\nOverview: ${deckSubtitle}` : ""}\n\nUse the speaker notes on each content slide for full context.`
    );
  };

  // ── Content slide ───────────────────────────────────────────────────────────
  const addContentSlide = (s, slideNum, totalContent) => {
    const slide = pptx.addSlide();
    slide.background = { color: bg };

    // Top accent bar
    slide.addShape(ST.rect, {
      x: 0, y: 0, w: SLIDE_W, h: 0.28,
      fill: { color: accent }, line: { color: accent, width: 0 },
    });

    // Left accent stripe
    slide.addShape(ST.rect, {
      x: 0, y: 0.28, w: 0.12, h: SLIDE_H - 0.28,
      fill: { color: mixHex(`#${accent}`, `#${bg}`, 0.35) },
      line: { width: 0 },
    });

    const hasImage = imageBySlide.has(s.index);

    // ── Image placement — top-right corner ──────────────────────────────────
    // Title spans left side; image occupies top-right corner.
    // Bullet text area is constrained to avoid overlap.
    if (hasImage) {
      const buf  = imageBySlide.get(s.index);
      const data = toPptxImageData(buf);
      if (data) {
        const imgX = SLIDE_W - IMG_W - IMG_MARGIN;
        const imgY = 0.38; // just below the top bar

        // Semi-transparent backing panel for image
        slide.addShape(ST.roundRect, {
          x: imgX - 0.06,
          y: imgY - 0.06,
          w: IMG_W + 0.12,
          h: IMG_H + 0.12,
          fill: { color: panelHex, transparency: 15 },
          line: { color: accent, width: 0.5 },
          rectRadius: 0.06,
        });

        slide.addImage({
          data,
          x: imgX,
          y: imgY,
          w: IMG_W,
          h: IMG_H,
          rounding: true,
          shadow: {
            type: "outer",
            color: "000000",
            blur: 5,
            offset: 2,
            angle: 225,
            opacity: 0.35,
          },
        });
      }
    }

    // Content panel (behind title + bullets)
    // When there's an image, the panel is narrower so it doesn't underlay the image zone
    const panelW = hasImage
      ? SLIDE_W - IMG_W - IMG_MARGIN * 2 - 0.38
      : SLIDE_W - 0.38 - 0.14;

    slide.addShape(ST.roundRect, {
      x: 0.38, y: 0.52,
      w: panelW, h: SLIDE_H - 0.52 - 0.06,
      fill: { color: panelHex, transparency: 20 },
      line: { color: accent, width: 0.75 },
      rectRadius: 0.06,
    });

    const titleText = String(s.title || `Slide ${s.index}`).slice(0, 200);

    // Title — constrained width so it never runs under the image
    const titleW = hasImage
      ? SLIDE_W - IMG_W - IMG_MARGIN * 2 - 0.72
      : SLIDE_W - 0.72;

    slide.addText(titleText, {
      x: 0.62, y: 0.68, w: titleW, h: 0.52,
      fontSize: 20, bold: true, color: accent,
      fontFace: "Calibri",
    });

    // Bullet text area
    // Height: leave room for image on right; vertically full when no image
    const textLeft = 0.65;
    const textTop  = 1.32;
    const textW    = hasImage ? SLIDE_W - IMG_W - IMG_MARGIN * 2 - 0.75 : SLIDE_W - 0.75;
    const textH    = SLIDE_H - textTop - 0.5;

    const bulletBlocks = (s.lines || []).filter(Boolean).map((line) => ({
      text: String(line),
      options: {
        bullet: { type: "bullet", indent: 10 },
        fontSize: 13,
        color: textCol,
        fontFace: "Calibri",
        paraSpaceBefore: 3,
        paraSpaceAfter: 3,
      },
    }));

    if (bulletBlocks.length > 0) {
      slide.addText(bulletBlocks, {
        x: textLeft, y: textTop, w: textW, h: textH,
        valign: "top", fit: "shrink",
      });
    } else {
      slide.addText("Add content in the generator step.", {
        x: textLeft, y: textTop, w: textW, h: 0.8,
        fontSize: 12, italic: true, color: textCol,
      });
    }

    // Footer counter
    slide.addText(`Slide2Notes  ·  ${slideNum} / ${totalContent}`, {
      x: 0.55, y: SLIDE_H - 0.38, w: 4.5, h: 0.28,
      fontSize: 9, color: accent,
    });

    // Speaker notes
    const notes = String(s.notes || "").trim();
    slide.addNotes(
      notes.slice(0, 12000) ||
      `Title: ${titleText}\n\nKey points:\n• ${(s.lines || []).slice(0, 12).join("\n• ")}`
    );
  };

  // ── References slide ────────────────────────────────────────────────────────
  const addReferencesSlide = (refs) => {
    if (!refs || refs.length === 0) return;

    const slide = pptx.addSlide();
    slide.background = { color: bg };

    slide.addShape(ST.rect, {
      x: 0, y: 0, w: SLIDE_W, h: 0.28,
      fill: { color: accent }, line: { color: accent, width: 0 },
    });
    slide.addShape(ST.rect, {
      x: 0, y: 0.28, w: 0.12, h: SLIDE_H - 0.28,
      fill: { color: mixHex(`#${accent}`, `#${bg}`, 0.35) },
      line: { width: 0 },
    });
    slide.addShape(ST.roundRect, {
      x: 0.38, y: 0.52, w: SLIDE_W - 0.52, h: SLIDE_H - 0.58,
      fill: { color: panelHex, transparency: 20 },
      line: { color: accent, width: 0.75 },
      rectRadius: 0.06,
    });

    slide.addText("References", {
      x: 0.62, y: 0.62, w: 8.5, h: 0.48,
      fontSize: 20, bold: true, color: accent, fontFace: "Calibri",
    });

    const refBlocks = refs.slice(0, 15).map((r, i) => ({
      text: `[${i + 1}]  ${r.title}${r.url ? `\n     ${r.url}` : ""}`,
      options: {
        fontSize: 9.5,
        color: textCol,
        fontFace: "Calibri",
        paraSpaceBefore: 4,
        paraSpaceAfter: 2,
        breakLine: false,
      },
    }));

    slide.addText(refBlocks, {
      x: 0.65, y: 1.2, w: SLIDE_W - 0.85, h: SLIDE_H - 1.65,
      valign: "top", fit: "shrink",
    });

    slide.addNotes(
      "References for the content enriched in this deck:\n\n" +
      refs.slice(0, 15).map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`).join("\n")
    );
  };

  // ── Assemble deck ────────────────────────────────────────────────────────────
  const slides         = opts.slides || [];
  const skipCoverSlide = Boolean(opts.skipCoverSlide);
  const hasCover       = Boolean(deckTitle) && !skipCoverSlide;
  const refs           = Array.isArray(opts.references) ? opts.references : [];

  if (hasCover) addCoverSlide();

  const totalContent = slides.length;
  let num = 0;
  for (const s of slides) {
    num += 1;
    addContentSlide(s, num, totalContent);
  }

  if (refs.length > 0) addReferencesSlide(refs);

  if (!hasCover && totalContent === 0) {
    const slide = pptx.addSlide();
    slide.addText("No slides to display.", { x: 1, y: 2, w: 8, h: 1 });
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}