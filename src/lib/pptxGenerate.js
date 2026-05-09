/**
 * pptxGenerate.js
 *
 * Build a .pptx deck from slide content + a template spec.
 * The template spec (from pptxTemplateSpec.js) fully controls layout,
 * shapes, colors and fonts — no hardcoded design decisions here.
 */
import pptxgen from "pptxgenjs";
import {
  W, H,
  buildColorMap,
  renderShapes,
  resolveZone,
  BUILTIN_SPECS,
  selectBuiltinSpec,
} from "@/lib/pptxTemplateSpec";

const LAYOUT = "LAYOUT_16x9";

// Image thumbnail dimensions
const IMG_W    = 2.6;
const IMG_H    = 1.75;
const IMG_MARG = 0.18;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sniffMime(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff) return "image/jpeg";
  if (buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4e&&buf[3]===0x47) return "image/png";
  if (buf[0]===0x47&&buf[1]===0x49&&buf[2]===0x46) return "image/gif";
  if (buf[0]===0x52&&buf[1]===0x49&&buf[2]===0x46&&buf[3]===0x46) return "image/webp";
  return null;
}

function toPptxImageData(bufOrAb) {
  const buf = bufOrAb instanceof Buffer ? bufOrAb : Buffer.from(new Uint8Array(bufOrAb));
  const mime = sniffMime(buf);
  if (!mime) return null;
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function rc(token, colorMap) {
  const t = String(token || "text").toLowerCase().trim();
  return colorMap[t] ?? colorMap.text;
}

// ── Slide builders ────────────────────────────────────────────────────────────

function buildCoverSlide(pptx, spec, colorMap, deckTitle, deckSubtitle) {
  const slide = pptx.addSlide();
  const ST = pptx.ShapeType;
  const cover = spec.cover;

  slide.background = { color: colorMap.bg };
  renderShapes(slide, cover.shapes, colorMap, ST);

  const tz = resolveZone(cover.title);
  slide.addText(deckTitle, {
    ...tz,
    fontSize: cover.title.fontSize ?? 36,
    bold:     cover.title.bold !== false,
    color:    rc(cover.title.color, colorMap),
    fontFace: spec.fonts?.title ?? "Calibri",
    align:    cover.title.align ?? "left",
  });

  if (deckSubtitle && cover.subtitle) {
    const sz = resolveZone(cover.subtitle);
    slide.addText(deckSubtitle, {
      ...sz,
      fontSize: cover.subtitle.fontSize ?? 16,
      bold:     false,
      color:    rc(cover.subtitle.color, colorMap),
      fontFace: spec.fonts?.body ?? "Calibri",
      align:    cover.subtitle.align ?? "left",
    });
  }

  if (cover.badge) {
    const bz = resolveZone(cover.badge);
    slide.addText(cover.badge.text ?? "Slide2Notes", {
      ...bz,
      fontSize: cover.badge.fontSize ?? 10,
      color:    rc(cover.badge.color, colorMap),
      fontFace: spec.fonts?.body ?? "Calibri",
    });
  }

  slide.addNotes(
    `Presentation: ${deckTitle}${deckSubtitle ? `\nOverview: ${deckSubtitle}` : ""}\n\nUse speaker notes on each slide for full context.`
  );
}

function buildContentSlide(pptx, spec, colorMap, s, slideNum, totalContent, imageData) {
  const slide = pptx.addSlide();
  const ST    = pptx.ShapeType;
  const ct    = spec.content;
  const hasImage = Boolean(imageData);

  slide.background = { color: colorMap.bg };
  renderShapes(slide, ct.shapes, colorMap, ST);

  // ── Compute dynamic layout zones that fill the full slide ─────────────────
  // The body always stretches from just below the title down to just above the footer.
  // This prevents the "half-empty slide" problem caused by hardcoded body heights.
  const FOOTER_H   = 0.28;                            // footer row height (inches)
  const FOOTER_Y   = H - FOOTER_H;                    // absolute Y where footer starts
  const MARGIN_BOT = 0.10;                            // gap between body bottom and footer

  const titleSpec    = hasImage ? (ct.title_img ?? ct.title) : ct.title;
  const bodySpecBase = hasImage ? (ct.body_img  ?? ct.body)  : ct.body;

  // Title zone — use spec-defined position (already anchored near the top)
  const titleY = (titleSpec.y    ?? 0.10) * H;
  const titleH = (titleSpec.h    ?? 0.16) * H;
  const titleX = (titleSpec.x    ?? 0.07) * W;
  const titleW = (titleSpec.w    ?? 0.88) * W;

  // Body: starts right below title, fills all remaining space above the footer
  const bodyTopGap = 0.12;                            // gap between title bottom and body top
  const bodyY  = titleY + titleH + bodyTopGap;
  const bodyX  = (bodySpecBase.x ?? 0.07) * W;
  const bodyW  = (bodySpecBase.w ?? 0.88) * W;
  const bodyH  = FOOTER_Y - bodyY - MARGIN_BOT;       // ← the key fix: fills all remaining height

  // ── Image — bottom-right corner of the body area, proportionally sized ───
  if (hasImage) {
    const imgH = Math.min(IMG_H, bodyH * 0.85);       // never taller than 85% of body
    const imgW = IMG_W * (imgH / IMG_H);               // maintain original aspect ratio
    const imgX = W - imgW - IMG_MARG;
    const imgY = bodyY + bodyH - imgH;                 // pin to bottom of body area

    slide.addShape(ST.roundRect, {
      x: imgX - 0.06, y: imgY - 0.06,
      w: imgW + 0.12,  h: imgH + 0.12,
      fill: { color: colorMap.panel, transparency: 15 },
      line: { color: colorMap.accent, width: 0.5 },
      rectRadius: 0.06,
    });
    slide.addImage({
      data: imageData,
      x: imgX, y: imgY, w: imgW, h: imgH,
      rounding: true,
      shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 225, opacity: 0.35 },
    });
  }

  // ── Panel background — stretches from title top all the way to footer ─────
  const p = ct.panel;
  if (p) {
    const panelY = titleY - 0.10;
    const panelH = FOOTER_Y - panelY - MARGIN_BOT;
    slide.addShape(ST.roundRect, {
      x: titleX - 0.12, y: panelY,
      w: titleW + 0.12,  h: panelH,
      fill: { color: rc(p.fill, colorMap), transparency: Math.round((1-(p.opacity??0.22))*100) },
      line: { color: rc(p.border ?? "accent", colorMap), width: p.borderW ?? 0.75 },
      rectRadius: (p.radius ?? 0.06) * H,
    });
  }

  // ── Title ─────────────────────────────────────────────────────────────────
  slide.addText(String(s.title || `Slide ${s.index}`).slice(0, 200), {
    x: titleX, y: titleY, w: titleW, h: titleH,
    fontSize: titleSpec.fontSize ?? 22,
    bold:     titleSpec.bold !== false,
    color:    rc(titleSpec.color, colorMap),
    fontFace: spec.fonts?.title ?? "Calibri",
  });

  // ── Body — narrows width if there's an image so text never overlaps it ────
  const effectiveBodyW = hasImage
    ? bodyW - IMG_W - IMG_MARG - 0.10   // leave room for image column
    : bodyW;

  const bullets = (s.lines || []).filter(Boolean).map((line) => ({
    text: String(line),
    options: {
      bullet:          { type: "bullet", indent: 10 },
      fontSize:        bodySpecBase.fontSize ?? 13,
      color:           rc(bodySpecBase.color, colorMap),
      fontFace:        spec.fonts?.body ?? "Calibri",
      paraSpaceBefore: 3,
      paraSpaceAfter:  3,
    },
  }));

  if (bullets.length > 0) {
    slide.addText(bullets, {
      x: bodyX, y: bodyY, w: effectiveBodyW, h: bodyH,
      valign: "top",
      fit: "shrink",    // auto-shrinks font if bullets overflow — never clips
    });
  } else {
    slide.addText("Add content in the generator step.", {
      x: bodyX, y: bodyY, w: effectiveBodyW, h: bodyH,
      fontSize: 12, italic: true, color: rc("text_muted", colorMap),
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  if (ct.footer) {
    slide.addText(`Slide2Notes  ·  ${slideNum} / ${totalContent}`, {
      x: (ct.footer.x ?? 0.07) * W,
      y: FOOTER_Y,
      w: W * 0.5,
      h: FOOTER_H,
      fontSize: ct.footer.fontSize ?? 9,
      color: rc(ct.footer.color ?? "accent", colorMap),
    });
  }

  const notes = String(s.notes || "").trim();
  slide.addNotes(notes.slice(0, 12000) || `Title: ${s.title}\n\nKey points:\n• ${(s.lines||[]).slice(0,12).join("\n• ")}`);
}

function buildReferencesSlide(pptx, spec, colorMap, refs) {
  if (!refs || refs.length === 0) return;
  const slide = pptx.addSlide();
  const ST    = pptx.ShapeType;
  const ct    = spec.content;

  slide.background = { color: colorMap.bg };
  renderShapes(slide, ct.shapes, colorMap, ST);

  const p = ct.panel;
  if (p) {
    slide.addShape(ST.roundRect, {
      x: 0.38, y: 0.52, w: W - 0.52, h: H - 0.58,
      fill: { color: rc(p.fill, colorMap), transparency: Math.round((1-(p.opacity??0.22))*100) },
      line: { color: rc(p.border ?? "accent", colorMap), width: p.borderW ?? 0.75 },
      rectRadius: (p.radius ?? 0.06) * H,
    });
  }

  const tz = resolveZone(ct.title);
  slide.addText("References", { ...tz, fontSize: ct.title.fontSize ?? 22, bold: true, color: rc(ct.title.color, colorMap), fontFace: spec.fonts?.title ?? "Calibri" });

  const refBlocks = refs.slice(0, 15).map((r, i) => ({
    text: `[${i+1}]  ${r.title}${r.url ? `\n     ${r.url}` : ""}`,
    options: { fontSize: 9.5, color: rc("text", colorMap), fontFace: spec.fonts?.body ?? "Calibri", paraSpaceBefore: 4, paraSpaceAfter: 2 },
  }));

  const bz = resolveZone(ct.body);
  slide.addText(refBlocks, { ...bz, y: bz.y + 0.1, valign: "top", fit: "shrink" });
  slide.addNotes("References:\n\n" + refs.slice(0,15).map((r,i) => `[${i+1}] ${r.title} — ${r.url}`).join("\n"));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function buildImprovedPptx(opts) {
  const pptx = new pptxgen();
  pptx.layout = LAYOUT;
  pptx.author = "Slide2Notes";
  pptx.title  = opts.title || "Improved presentation";

  let spec;
  if (opts.templateSpec && opts.templateSpec.cover && opts.templateSpec.content) {
    spec = opts.templateSpec;
  } else {
    const key = opts.templateKey ?? selectBuiltinSpec(opts.theme, opts.instructions ?? "");
    spec = BUILTIN_SPECS[key] ?? BUILTIN_SPECS.diagonal_burst;
  }

  const colorMap = buildColorMap(opts.theme);

  const imageBySlide = new Map();
  for (const im of opts.images || []) {
    if (!imageBySlide.has(im.slideIndex)) {
      const data = toPptxImageData(im.data);
      if (data) imageBySlide.set(im.slideIndex, data);
    }
  }

  const deckTitle    = String(opts.title    || "Presentation").slice(0, 200);
  const deckSubtitle = String(opts.subtitle || "").slice(0, 280);
  const skipCover    = Boolean(opts.skipCoverSlide);

  if (!skipCover && deckTitle) buildCoverSlide(pptx, spec, colorMap, deckTitle, deckSubtitle);

  const slides       = opts.slides || [];
  const totalContent = slides.length;
  let   slideNum     = 0;
  for (const s of slides) {
    slideNum++;
    buildContentSlide(pptx, spec, colorMap, s, slideNum, totalContent, imageBySlide.get(s.index) ?? null);
  }

  const refs = Array.isArray(opts.references) ? opts.references : [];
  if (refs.length > 0) buildReferencesSlide(pptx, spec, colorMap, refs);

  if (!deckTitle && totalContent === 0) {
    const slide = pptx.addSlide();
    slide.addText("No slides to display.", { x: 1, y: 2, w: 8, h: 1 });
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}