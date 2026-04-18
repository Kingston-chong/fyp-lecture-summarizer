/**
 * pptxMasterTemplate.js
 *
 * Inject decorative visual templates into a .pptx slide master.
 * This makes the themed deck look like a professionally designed Slidesgo/Canva
 * template — gradients, geometric shapes, organic blobs, accent bars — without
 * any external service or proprietary files.
 *
 * Strategy:
 *   1. Parse slide dimensions from presentation.xml
 *   2. Remove any previous Slide2Notes decoration (by id range 9000-9099)
 *   3. Insert new decorative <p:sp> shapes into the slide MASTER's <p:spTree>
 *      BEFORE existing placeholder elements so decorations sit behind content
 *   4. Also patch each slide's spTree for per-slide accents (e.g. title underline)
 *
 * All shapes use explicit srgbClr (no schemeClr) so colors survive future
 * theme patches.
 */

import JSZip from "jszip";

// ── EMU constants ─────────────────────────────────────────────────────────────
const IN = 914400;        // 1 inch in EMUs
const SLIDE_W = 9144000; // 10 inches (standard 16:9)
const SLIDE_H = 5143500; // 5.625 inches

// ── Color math ────────────────────────────────────────────────────────────────
function parseHex(hex) {
  const h = String(hex || "").replace(/^#/, "").trim();
  if (h.length !== 6) return null;
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function hex6(c) {
  return [c.r, c.g, c.b].map(n => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0")).join("").toUpperCase();
}
function lighten(c, t) { return { r: c.r+(255-c.r)*t, g: c.g+(255-c.g)*t, b: c.b+(255-c.b)*t }; }
function darken(c, t)  { return { r: c.r*(1-t), g: c.g*(1-t), b: c.b*(1-t) }; }
function mix(a, b, t)  { return { r: a.r+(b.r-a.r)*t, g: a.g+(b.g-a.g)*t, b: a.b+(b.b-a.b)*t }; }
function lum(c) {
  const s = (v) => { const n=v/255; return n<=0.04045?n/12.92:Math.pow((n+0.055)/1.055,2.4); };
  return 0.2126*s(c.r)+0.7152*s(c.g)+0.0722*s(c.b);
}
function alpha(pct) { return Math.round(pct * 1000); } // % → OOXML alpha (100000 = fully opaque)

// ── OOXML shape builders ──────────────────────────────────────────────────────

const DECOR_ID_START = 9000;

function noFillLn() { return `<a:ln><a:noFill/></a:ln>`; }

function solidFill(colorHex, opacityPct = 100) {
  const a = Math.round(opacityPct * 1000);
  return `<a:solidFill><a:srgbClr val="${colorHex}"><a:alpha val="${a}"/></a:srgbClr></a:solidFill>`;
}

function gradFill(color1Hex, color2Hex, angleDeg = 0, alpha1 = 100, alpha2 = 100) {
  const ang = Math.round(angleDeg * 60000);
  const a1  = Math.round(alpha1 * 1000);
  const a2  = Math.round(alpha2 * 1000);
  return (
    `<a:gradFill><a:lin ang="${ang}" scaled="0"/><a:gsLst>` +
    `<a:gs pos="0"><a:srgbClr val="${color1Hex}"><a:alpha val="${a1}"/></a:srgbClr></a:gs>` +
    `<a:gs pos="100000"><a:srgbClr val="${color2Hex}"><a:alpha val="${a2}"/></a:srgbClr></a:gs>` +
    `</a:gsLst></a:gradFill>`
  );
}

function sp({ id, name, x, y, cx, cy, geom = "rect", fill, rot = 0 }) {
  const rotAttr = rot ? ` rot="${Math.round(rot * 60000)}"` : "";
  return (
    `<p:sp><p:nvSpPr>` +
    `<p:cNvPr id="${id}" name="${name}"/>` +
    `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/>` +
    `</p:nvSpPr><p:spPr>` +
    `<a:xfrm${rotAttr}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>` +
    fill +
    noFillLn() +
    `</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

// ── Template definitions ──────────────────────────────────────────────────────

/**
 * Each template is a function(theme, W, H) → string of <p:sp> elements.
 * theme = { bg, acc, txt, panel } — all parsed as {r,g,b} objects.
 * Colors are all explicit hex, no schemeClr.
 */
const TEMPLATES = {

  /**
   * "Diagonal Flow" — bold diagonal color band across the slide.
   * Inspired by: modern gradient presentations.
   */
  diagonal_flow(theme, W, H) {
    const { bg, acc } = theme;
    const accH = hex6(acc);
    const accDark = hex6(darken(acc, 0.35));
    const bgH = hex6(bg);
    const shapes = [];
    let id = DECOR_ID_START;

    // Full background gradient: bg → slightly lighter bg
    shapes.push(sp({
      id: id++, name: "S2N_BgGrad", x: 0, y: 0, cx: W, cy: H,
      fill: gradFill(hex6(lighten(bg, 0.04)), bgH, 135),
    }));

    // Diagonal accent band (parallelogram-ish using a rotated wide rectangle)
    // Top-right corner triangle effect via clipping
    shapes.push(sp({
      id: id++, name: "S2N_DiagBand", x: Math.round(W*0.62), y: -H*0.3, cx: Math.round(W*0.55), cy: Math.round(H*1.6),
      geom: "rect",
      fill: gradFill(accH, accDark, 160, 18, 8),
      rot: -12,
    }));

    // Thin accent line at bottom
    shapes.push(sp({
      id: id++, name: "S2N_BottomBar", x: 0, y: H - Math.round(IN * 0.06), cx: W, cy: Math.round(IN * 0.06),
      fill: solidFill(accH, 70),
    }));

    // Small accent dot cluster top-left
    shapes.push(sp({
      id: id++, name: "S2N_DotL1", x: Math.round(IN*0.3), y: Math.round(IN*0.25), cx: Math.round(IN*0.18), cy: Math.round(IN*0.18),
      geom: "ellipse", fill: solidFill(accH, 40),
    }));
    shapes.push(sp({
      id: id++, name: "S2N_DotL2", x: Math.round(IN*0.58), y: Math.round(IN*0.15), cx: Math.round(IN*0.10), cy: Math.round(IN*0.10),
      geom: "ellipse", fill: solidFill(accH, 25),
    }));

    return shapes.join("");
  },

  /**
   * "Botanical" — organic circle blobs in corners, like Slidesgo nature templates.
   * Best for: green, teal, forest themes.
   */
  botanical(theme, W, H) {
    const { bg, acc } = theme;
    const accH = hex6(acc);
    const accLight = hex6(lighten(acc, 0.3));
    const bgH = hex6(bg);
    const shapes = [];
    let id = DECOR_ID_START;

    // Solid background
    shapes.push(sp({ id: id++, name: "S2N_Bg", x: 0, y: 0, cx: W, cy: H, fill: solidFill(bgH) }));

    // Large blob top-right
    shapes.push(sp({
      id: id++, name: "S2N_BlobTR", x: Math.round(W*0.78), y: -Math.round(H*0.25),
      cx: Math.round(W*0.32), cy: Math.round(H*0.65),
      geom: "ellipse", fill: solidFill(accH, 22),
    }));
    // Medium blob top-right (offset)
    shapes.push(sp({
      id: id++, name: "S2N_BlobTR2", x: Math.round(W*0.88), y: -Math.round(H*0.1),
      cx: Math.round(W*0.20), cy: Math.round(H*0.45),
      geom: "ellipse", fill: solidFill(accLight, 30),
    }));

    // Bottom-left blob
    shapes.push(sp({
      id: id++, name: "S2N_BlobBL", x: -Math.round(W*0.08), y: Math.round(H*0.65),
      cx: Math.round(W*0.28), cy: Math.round(H*0.55),
      geom: "ellipse", fill: solidFill(accH, 18),
    }));

    // Accent stripe left edge
    shapes.push(sp({
      id: id++, name: "S2N_LeftBar", x: 0, y: Math.round(H*0.15), cx: Math.round(IN*0.08), cy: Math.round(H*0.55),
      fill: gradFill(accH, hex6(bg), 180, 90, 0),
    }));

    // Bottom accent bar full width
    shapes.push(sp({
      id: id++, name: "S2N_BottomBar", x: 0, y: H - Math.round(IN*0.12), cx: Math.round(W*0.45), cy: Math.round(IN*0.07),
      fill: solidFill(accH, 55),
    }));

    return shapes.join("");
  },

  /**
   * "Geometric Grid" — clean lines and rectangles, corporate/tech feel.
   * Best for: professional, dark, slate, ocean themes.
   */
  geometric_grid(theme, W, H) {
    const { bg, acc } = theme;
    const accH = hex6(acc);
    const bgH = hex6(bg);
    const bgLighter = hex6(lighten(bg, 0.06));
    const shapes = [];
    let id = DECOR_ID_START;

    // Background with subtle gradient
    shapes.push(sp({
      id: id++, name: "S2N_Bg", x: 0, y: 0, cx: W, cy: H,
      fill: gradFill(bgH, bgLighter, 315),
    }));

    // Left vertical thick bar
    shapes.push(sp({
      id: id++, name: "S2N_LeftBar", x: 0, y: 0, cx: Math.round(IN*0.22), cy: H,
      fill: gradFill(accH, hex6(darken(acc, 0.25)), 180, 80, 40),
    }));

    // Top horizontal accent strip
    shapes.push(sp({
      id: id++, name: "S2N_TopBar", x: Math.round(IN*0.22), y: 0, cx: W, cy: Math.round(IN*0.065),
      fill: solidFill(accH, 35),
    }));

    // Bottom-right corner block
    shapes.push(sp({
      id: id++, name: "S2N_BRBlock", x: Math.round(W*0.8), y: Math.round(H*0.88),
      cx: Math.round(W*0.2), cy: Math.round(H*0.12),
      fill: solidFill(accH, 20),
    }));

    // Thin decorative lines (right side)
    for (let i = 0; i < 3; i++) {
      shapes.push(sp({
        id: id++, name: `S2N_Line${i}`, x: Math.round(W*0.88)+i*Math.round(IN*0.08), y: Math.round(H*0.1),
        cx: Math.round(IN*0.02), cy: Math.round(H*0.5),
        fill: solidFill(accH, 12 - i*3),
      }));
    }

    return shapes.join("");
  },

  /**
   * "Gradient Wash" — full-bleed gradient background, modern and bold.
   * Best for: cyber, neon, aurora, vibrant themes.
   */
  gradient_wash(theme, W, H) {
    const { bg, acc } = theme;
    const accH = hex6(acc);
    const bgH = hex6(bg);
    const bgMid = hex6(mix(bg, acc, 0.08));
    const shapes = [];
    let id = DECOR_ID_START;

    // Full gradient background
    shapes.push(sp({
      id: id++, name: "S2N_BgGrad", x: 0, y: 0, cx: W, cy: H,
      fill: gradFill(bgH, bgMid, 135),
    }));

    // Glowing top-right halo
    shapes.push(sp({
      id: id++, name: "S2N_HaloTR", x: Math.round(W*0.55), y: -Math.round(H*0.3),
      cx: Math.round(W*0.65), cy: Math.round(H*0.65),
      geom: "ellipse", fill: gradFill(accH, bgH, 0, 12, 0),
    }));

    // Glowing bottom-left halo
    shapes.push(sp({
      id: id++, name: "S2N_HaloBL", x: -Math.round(W*0.1), y: Math.round(H*0.6),
      cx: Math.round(W*0.45), cy: Math.round(H*0.6),
      geom: "ellipse", fill: gradFill(accH, bgH, 0, 8, 0),
    }));

    // Noise texture overlay via semi-transparent rect with a thin pattern
    shapes.push(sp({
      id: id++, name: "S2N_Overlay", x: 0, y: 0, cx: W, cy: H,
      fill: solidFill(bgH, 8),
    }));

    // Bottom accent bar
    shapes.push(sp({
      id: id++, name: "S2N_BottomGlow", x: 0, y: H - Math.round(IN*0.08), cx: W, cy: Math.round(IN*0.08),
      fill: gradFill(accH, accH, 0, 45, 5),
    }));

    // Small grid of dots top-left decorative
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        shapes.push(sp({
          id: id++, name: `S2N_Dot${row}_${col}`,
          x: Math.round(IN*(0.35 + col*0.22)), y: Math.round(IN*(0.35 + row*0.22)),
          cx: Math.round(IN*0.055), cy: Math.round(IN*0.055),
          geom: "ellipse", fill: solidFill(accH, 18),
        }));
      }
    }

    return shapes.join("");
  },

  /**
   * "Terracotta / Warm Academic" — earthy textures, serif-adjacent warmth.
   * Best for: light academic, parchment, desert, warm themes.
   */
  warm_academic(theme, W, H) {
    const { bg, acc } = theme;
    const accH = hex6(acc);
    const bgH = hex6(bg);
    const accLight = hex6(lighten(parseHex("#" + accH), 0.6));
    const shapes = [];
    let id = DECOR_ID_START;

    // Warm background
    shapes.push(sp({ id: id++, name: "S2N_Bg", x: 0, y: 0, cx: W, cy: H, fill: solidFill(bgH) }));

    // Top border thick rule
    shapes.push(sp({
      id: id++, name: "S2N_TopRule", x: 0, y: 0, cx: W, cy: Math.round(IN*0.12),
      fill: solidFill(accH),
    }));

    // Left margin rule — thin decorative
    shapes.push(sp({
      id: id++, name: "S2N_LeftRule", x: Math.round(IN*0.55), y: Math.round(IN*0.12),
      cx: Math.round(IN*0.025), cy: Math.round(H*0.7),
      fill: solidFill(accH, 30),
    }));

    // Corner ornament top-right: nested squares
    for (let i = 0; i < 3; i++) {
      const size = Math.round(IN * (0.35 - i*0.1));
      shapes.push(sp({
        id: id++, name: `S2N_Corner${i}`,
        x: W - Math.round(IN*0.6) + i*Math.round(IN*0.08),
        y: Math.round(IN*0.15) + i*Math.round(IN*0.08),
        cx: size, cy: size,
        fill: solidFill(accH, 20 - i*5),
      }));
    }

    // Bottom ornament: full-width thin rule
    shapes.push(sp({
      id: id++, name: "S2N_BottomRule", x: Math.round(IN*0.55), y: H - Math.round(IN*0.25),
      cx: W - Math.round(IN*0.55), cy: Math.round(IN*0.025),
      fill: solidFill(accH, 40),
    }));

    // Right accent block
    shapes.push(sp({
      id: id++, name: "S2N_RightAccent", x: W - Math.round(IN*0.18), y: Math.round(IN*0.12),
      cx: Math.round(IN*0.18), cy: H - Math.round(IN*0.12),
      fill: solidFill(accH, 8),
    }));

    return shapes.join("");
  },

  /**
   * "Minimal Edge" — ultra-clean, just a few precise lines.
   * Best for: slate, arctic, white, corporate themes.
   */
  minimal_edge(theme, W, H) {
    const { bg, acc } = theme;
    const accH = hex6(acc);
    const bgH = hex6(bg);
    const shapes = [];
    let id = DECOR_ID_START;

    shapes.push(sp({ id: id++, name: "S2N_Bg", x: 0, y: 0, cx: W, cy: H, fill: solidFill(bgH) }));

    // Top accent strip
    shapes.push(sp({
      id: id++, name: "S2N_TopStrip", x: 0, y: 0, cx: W, cy: Math.round(IN*0.065),
      fill: solidFill(accH),
    }));

    // Left thick accent bar
    shapes.push(sp({
      id: id++, name: "S2N_LeftThick", x: 0, y: Math.round(IN*0.065), cx: Math.round(IN*0.18), cy: H,
      fill: solidFill(accH, 12),
    }));

    // Right thin vertical line
    shapes.push(sp({
      id: id++, name: "S2N_RightLine", x: W - Math.round(IN*0.015), y: Math.round(IN*0.065),
      cx: Math.round(IN*0.015), cy: H - Math.round(IN*0.065),
      fill: solidFill(accH, 18),
    }));

    // Bottom rule
    shapes.push(sp({
      id: id++, name: "S2N_BottomLine", x: Math.round(IN*0.18), y: H - Math.round(IN*0.05),
      cx: W - Math.round(IN*0.2), cy: Math.round(IN*0.05),
      fill: solidFill(accH, 50),
    }));

    return shapes.join("");
  },
};

// ── Template selector ─────────────────────────────────────────────────────────

/**
 * Pick the best template for the given theme colors.
 * Logic based on background luminance, accent hue, and theme intent.
 */
function selectTemplate(theme) {
  const bgLum  = lum(theme.bg);
  const accLum = lum(theme.acc);

  // Hue detection from accent
  const { r, g, b } = theme.acc;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  if (max !== min) {
    if (max === r) hue = ((g - b) / (max - min) + 6) % 6 * 60;
    else if (max === g) hue = ((b - r) / (max - min) + 2) * 60;
    else hue = ((r - g) / (max - min) + 4) * 60;
  }

  // Green hues (90-165°) → botanical
  if (hue >= 90 && hue <= 165) return "botanical";

  // Light backgrounds
  if (bgLum > 0.5) {
    if (hue >= 20 && hue <= 55) return "warm_academic"; // orange/amber/terracotta
    return "minimal_edge";
  }

  // Dark backgrounds
  if (accLum > 0.5) return "gradient_wash"; // very bright accent = neon/aurora
  if (hue >= 200 && hue <= 260) return "geometric_grid"; // blue/purple/slate
  return "diagonal_flow"; // default dark
}

// ── Master XML patcher ────────────────────────────────────────────────────────

/**
 * Remove previously injected Slide2Notes decoration shapes from XML.
 * Matches shapes with id in range 9000–9099 or name starting with "S2N_".
 */
function removeOldDecoration(xml) {
  // Remove <p:sp> blocks where cNvPr id is in 9000-9099 or name starts with S2N_
  return xml.replace(
    /<p:sp>[\s\S]*?<p:cNvPr\s+id="(9\d{3})"\s+name="[^"]*"[\s\S]*?<\/p:sp>/g,
    ""
  ).replace(
    /<p:sp>[\s\S]*?<p:cNvPr\s+id="[^"]*"\s+name="S2N_[^"]*"[\s\S]*?<\/p:sp>/g,
    ""
  );
}

/**
 * Inject decoration shapes at the START of <p:spTree> (before placeholders)
 * so they render behind slide content.
 */
function injectIntoSpTree(xml, shapesXml) {
  // Insert after the required <p:nvGrpSpPr> and <p:grpSpPr> opening elements
  return xml.replace(
    /(<p:spTree>[\s\S]*?<\/p:grpSpPr>)/,
    `$1${shapesXml}`
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply a visual template to the slide master and optionally per-slide.
 *
 * @param {Buffer} sourceBuffer   Original .pptx bytes
 * @param {{
 *   background: string;  "#RRGGBB"
 *   accent: string;      "#RRGGBB"
 *   text: string;        "#RRGGBB"
 *   panel?: string;
 * }} theme
 * @param {{ templateName?: string }} options
 *   templateName: force a specific template key; auto-selects if omitted
 * @returns {Promise<Buffer>}
 */
export async function applyMasterTemplate(sourceBuffer, theme, options = {}) {
  const zip = await JSZip.loadAsync(sourceBuffer);

  const bg  = parseHex(theme.background);
  const acc = parseHex(theme.accent);
  const txt = parseHex(theme.text);
  if (!bg || !acc || !txt) return sourceBuffer;

  const parsedTheme = { bg, acc, txt };

  // Select template
  const templateKey = options.templateName && TEMPLATES[options.templateName]
    ? options.templateName
    : selectTemplate(parsedTheme);

  const buildShapes = TEMPLATES[templateKey];
  const shapesXml = buildShapes(parsedTheme, SLIDE_W, SLIDE_H);

  // Get slide dimensions (in case non-standard)
  // (use defaults if not found)

  // Patch slide master
  const masterPaths = Object.keys(zip.files).filter(
    (p) => /^ppt\/slideMasters\/slideMaster\d*\.xml$/i.test(p)
  );

  for (const masterPath of masterPaths) {
    let xml = await zip.file(masterPath).async("string");
    xml = removeOldDecoration(xml);
    xml = injectIntoSpTree(xml, shapesXml);
    zip.file(masterPath, xml);
  }

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

/** Export template names for use in UI / LLM prompts. */
export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

/** Export the selector for testing. */
export { selectTemplate };