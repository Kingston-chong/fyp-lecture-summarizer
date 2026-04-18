/**
 * pptxThemePatch.js
 *
 * Apply a new color theme to an existing .pptx buffer WITHOUT rebuilding the deck.
 * All text structure (bullets, tables, alignment, fonts, spacing) is preserved exactly.
 * Only colors change.
 *
 * Strategy:
 *   1. Patch ppt/theme/theme1.xml  — replaces the clrScheme (dk1/lt1/dk2/lt2/accent1-6).
 *      Most well-authored decks use schemeClr references, so this propagates automatically
 *      to titles, body text, shape fills, and borders.
 *
 *   2. Patch slide backgrounds — each ppt/slides/slideN.xml may have an explicit
 *      <p:bg><p:bgPr><a:solidFill><a:srgbClr val="..."/> that overrides the master.
 *      We replace those with the new background color.
 *
 *   3. Patch slide master backgrounds — ppt/slideMasters/slideMaster1.xml often has
 *      an explicit bg fill. Replace it too.
 *
 *   4. Patch explicit srgbClr values on shape fills/lines that are clearly the OLD
 *      background or accent color (within a perceptual distance threshold). This catches
 *      shapes like accent bars that were hand-colored to match the original theme.
 *      Text run colors (a:rPr) are intentionally NOT touched — preserving readable text.
 *
 * What is NOT changed:
 *   - Text content, bullets, numbering, indentation
 *   - Tables (structure, borders defined via schemeClr update automatically)
 *   - Images, charts, diagrams
 *   - Font faces, font sizes, bold/italic/underline
 *   - Paragraph alignment, spacing, line height
 *   - Shape geometry and position
 */

import JSZip from "jszip";

// ── Color math helpers ─────────────────────────────────────────────────────────

/** Parse "#RRGGBB" or "RRGGBB" → { r, g, b } (0-255). */
function parseHex(hex) {
  const h = String(hex || "").replace(/^#/, "").trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

/** { r, g, b } → "RRGGBB" (no hash, uppercase). */
function toHex6(r, g, b) {
  return [r, g, b]
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Perceptual color distance (Euclidean in RGB, good enough for our use). */
function colorDist(a, b) {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
    (a.g - b.g) ** 2 +
    (a.b - b.b) ** 2
  );
}

/** Lighten a color toward white by `t` (0-1). */
function lighten(c, t) {
  return {
    r: c.r + (255 - c.r) * t,
    g: c.g + (255 - c.g) * t,
    b: c.b + (255 - c.b) * t,
  };
}

/** Darken a color toward black by `t` (0-1). */
function darken(c, t) {
  return { r: c.r * (1 - t), g: c.g * (1 - t), b: c.b * (1 - t) };
}

/** Mix two colors: result = a*(1-t) + b*t */
function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

// ── Theme color scheme builder ─────────────────────────────────────────────────

/**
 * Build a full OOXML clrScheme XML from our 4-color palette.
 *
 * Mapping:
 *   lt1  (light 1)  = background        → used as slide background via schemeClr bg1
 *   dk1  (dark 1)   = text color        → used as default body text via schemeClr tx1
 *   lt2  (light 2)  = panel color       → used as secondary bg / card fill
 *   dk2  (dark 2)   = slightly darker accent → used for secondary elements
 *   accent1         = accent color      → used for headings, highlights
 *   accent2-6       = variations of accent (lighter/darker) for charts, etc.
 *   hlink           = accent (hyperlinks)
 *   folHlink        = slightly dimmer accent
 */
function buildClrSchemeXml(theme) {
  const bg  = parseHex(theme.background);
  const acc = parseHex(theme.accent);
  const txt = parseHex(theme.text);
  const pan = parseHex(theme.panel);

  if (!bg || !acc || !txt) throw new Error("Invalid theme colors");

  // Derive accent variations
  const accent2 = lighten(acc, 0.25);
  const accent3 = lighten(acc, 0.45);
  const accent4 = darken(acc, 0.20);
  const accent5 = mix(acc, bg, 0.35);
  const accent6 = mix(acc, txt, 0.30);

  const dk1 = toHex6(txt.r, txt.g, txt.b);           // body text
  const lt1 = toHex6(bg.r,  bg.g,  bg.b);            // background
  const dk2 = toHex6(...Object.values(darken(acc, 0.15)).map(Math.round)); // dk accent

  // lt2 is used as table alternating-row fill and panel fill.
  // If the explicit panel color was supplied, use it directly.
  // Otherwise, derive it as a very subtle tint of the background toward white/black
  // (NOT toward accent) so that body text (dk1/tx1) stays readable on lt2 rows.
  // A 12% shift toward white keeps it neutral; for dark backgrounds this produces
  // a slightly lighter shade, for light backgrounds a slightly darker shade.
  let lt2;
  if (pan) {
    lt2 = toHex6(pan.r, pan.g, pan.b);
  } else {
    // Determine if background is dark or light by luminance
    const lum = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
    const shifted = lum < 128
      ? lighten(bg, 0.18)   // dark bg → shift toward white
      : darken(bg, 0.10);   // light bg → shift toward black
    lt2 = toHex6(...Object.values(shifted).map(Math.round));
  }

  return `<a:clrScheme name="Slide2Notes Theme">` +
    `<a:dk1><a:srgbClr val="${dk1}"/></a:dk1>` +
    `<a:lt1><a:srgbClr val="${lt1}"/></a:lt1>` +
    `<a:dk2><a:srgbClr val="${dk2}"/></a:dk2>` +
    `<a:lt2><a:srgbClr val="${lt2}"/></a:lt2>` +
    `<a:accent1><a:srgbClr val="${toHex6(acc.r, acc.g, acc.b)}"/></a:accent1>` +
    `<a:accent2><a:srgbClr val="${toHex6(...Object.values(accent2).map(Math.round))}"/></a:accent2>` +
    `<a:accent3><a:srgbClr val="${toHex6(...Object.values(accent3).map(Math.round))}"/></a:accent3>` +
    `<a:accent4><a:srgbClr val="${toHex6(...Object.values(accent4).map(Math.round))}"/></a:accent4>` +
    `<a:accent5><a:srgbClr val="${toHex6(...Object.values(accent5).map(Math.round))}"/></a:accent5>` +
    `<a:accent6><a:srgbClr val="${toHex6(...Object.values(accent6).map(Math.round))}"/></a:accent6>` +
    `<a:hlink><a:srgbClr val="${toHex6(acc.r, acc.g, acc.b)}"/></a:hlink>` +
    `<a:folHlink><a:srgbClr val="${toHex6(...Object.values(darken(acc, 0.25)).map(Math.round))}"/></a:folHlink>` +
    `</a:clrScheme>`;
}

// ── XML patching helpers ───────────────────────────────────────────────────────

/**
 * Replace the entire <a:clrScheme ...>...</a:clrScheme> block in theme XML.
 */
function patchThemeXml(themeXml, newClrSchemeXml) {
  // Replace existing clrScheme
  const patched = themeXml.replace(
    /<a:clrScheme[\s\S]*?<\/a:clrScheme>/,
    newClrSchemeXml
  );
  if (patched === themeXml) {
    // No existing clrScheme — inject before </a:themeElements>
    return themeXml.replace(
      /<\/a:themeElements>/,
      `${newClrSchemeXml}</a:themeElements>`
    );
  }
  return patched;
}

/**
 * Replace or inject a solid background fill in a slide XML.
 * Handles:
 *   <p:bg><p:bgPr><a:solidFill><a:srgbClr val="..."/>  → replace val
 *   <p:bg><p:bgRef .../>                                 → replace with explicit solidFill
 *   No <p:bg> at all                                     → inject after <p:cSld>
 */
function patchSlideBg(slideXml, bgHex) {
  const val = bgHex.replace(/^#/, "").toUpperCase();
  const newBgPr =
    `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${val}"/></a:solidFill>` +
    `<a:effectLst/></p:bgPr></p:bg>`;

  // Replace existing <p:bg>...</p:bg>
  if (/<p:bg[\s>]/.test(slideXml)) {
    return slideXml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, newBgPr);
  }

  // No bg element — inject inside <p:cSld>
  return slideXml.replace(/<p:cSld[^>]*>/, (match) => `${match}${newBgPr}`);
}

/**
 * In shape fill/line XML, replace hardcoded srgbClr values that are "close" to
 * the old background or old accent with the new equivalents.
 *
 * We do this ONLY on:
 *   - <a:solidFill> inside <p:spPr> (shape property fills)
 *   - <a:solidFill> inside <a:ln>   (shape outline/line)
 *   - <a:solidFill> inside <p:grpSpPr> (group fills)
 *
 * We explicitly do NOT touch:
 *   - <a:rPr> (run properties = text color) — preserves all text colors
 *   - <a:pPr> (paragraph properties)
 *   - Any fill inside <p:txBody>
 *
 * This catches accent bars, dividers, and panel backgrounds that were
 * manually colored to match the original theme.
 *
 * @param {string} slideXml
 * @param {{ background: string; accent: string; panel: string }} oldTheme  Detected from slide
 * @param {{ background: string; accent: string; panel: string }} newTheme
 * @param {number} threshold  Color distance threshold (default 60 — fairly generous)
 */
function patchShapeFills(slideXml, oldTheme, newTheme, threshold = 60) {
  const oldColors = [
    { src: parseHex(oldTheme.background), dst: parseHex(newTheme.background) },
    { src: parseHex(oldTheme.accent),     dst: parseHex(newTheme.accent) },
    { src: parseHex(oldTheme.panel),      dst: parseHex(newTheme.panel) },
  ].filter((x) => x.src && x.dst);

  if (oldColors.length === 0) return slideXml;

  // Match <a:solidFill> blocks that are inside <p:spPr>, <a:ln>, or <p:grpSpPr>
  // but NOT inside <p:txBody> (which contains text run colors) or <a:tc> (table
  // cells — their fills are intentional table styling and must not be recolored).
  // Strategy: split on txBody and table-cell boundaries, only recolor the gaps.

  // First neutralise table cells, then neutralise text bodies.
  const withTableCellsMarked = slideXml.replace(
    /(<a:tc[\s>][\s\S]*?<\/a:tc>)/g,
    "\x00TC_START\x00$1\x00TC_END\x00"
  );

  const parts = withTableCellsMarked.split(
    /(<p:txBody>[\s\S]*?<\/p:txBody>|\x00TC_START\x00[\s\S]*?\x00TC_END\x00)/
  );

  const recolorPart = (part) =>
    part.replace(/<a:srgbClr\s+val="([0-9A-Fa-f]{6})"\s*\/>/g, (match, hexVal) => {
      const c = parseHex(hexVal);
      if (!c) return match;
      for (const { src, dst } of oldColors) {
        if (colorDist(c, src) < threshold) {
          return `<a:srgbClr val="${toHex6(dst.r, dst.g, dst.b)}"/>`;
        }
      }
      return match;
    });

  return parts
    .map((part, i) => {
      // Odd-indexed parts are <p:txBody>...</p:txBody> or <a:tc>...</a:tc> — leave untouched
      if (i % 2 === 1) return part.replace(/\x00TC_START\x00|\x00TC_END\x00/g, "");
      return recolorPart(part);
    })
    .join("");
}

/**
 * Extract the dominant background color from a slide XML (for old-theme detection).
 * Returns "#RRGGBB" or null.
 */
function extractSlideBgColor(slideXml) {
  const m = slideXml.match(/<p:bg>[\s\S]*?<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/);
  return m ? `#${m[1]}` : null;
}

// ── Explicit table style injector ─────────────────────────────────────────────

/**
 * Build a complete <a:tblStyleLst> XML with one explicit table style per GUID.
 *
 * WHY THIS EXISTS:
 *   PowerPoint table styles are driven by a styleId GUID that references the
 *   built-in Office table style library.  Those built-in styles use schemeClr
 *   references (tx1, lt2, accent1 …) which automatically inherit from the deck's
 *   clrScheme.  When we update the clrScheme for theming, tables inherit the new
 *   scheme colors — but the text color (dk1/tx1) is often a light tint that
 *   becomes invisible against the light-tinted band rows (lt2/accent1 tints).
 *
 *   The only reliable fix is to replace the built-in style reference with a
 *   fully-explicit style that uses <a:srgbClr> everywhere — no schemeClr.
 *   This makes table appearance 100% predictable regardless of theme changes.
 *
 * @param {string[]} styleIds  GUIDs found in the deck (e.g. "{5C22544A-...}")
 * @param {{ background: string; accent: string; text: string }} theme
 * @returns {string}  Complete tableStyles.xml content
 */
function buildExplicitTableStylesXml(styleIds, theme) {
  const bg  = parseHex(theme.background);
  const acc = parseHex(theme.accent);
  const txt = parseHex(theme.text);
  if (!bg || !acc || !txt) return null;

  // ── Color helpers ────────────────────────────────────────────────────────────
  const hex6 = (c) => toHex6(c.r, c.g, c.b);

  function relativeLuminance(c) {
    const toLinear = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
  }

  function contrastRatio(a, b) {
    const la = relativeLuminance(a), lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function bestTextOn(bg_c) {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 17,  g: 17,  b: 17  };
    return contrastRatio(white, bg_c) >= contrastRatio(black, bg_c) ? white : black;
  }

  // Header row: accent fill, maximum-contrast text
  const hdrText = bestTextOn(acc);

  // Band rows: subtle background variants (NOT accent-tinted)
  const bgLum = relativeLuminance(bg);
  const band1 = bgLum < 0.15 ? lighten(bg, 0.14) : darken(bg, 0.07);  // odd rows
  const band2 = bg;                                                       // even rows = plain bg

  // Body text: use the theme text color IF it has sufficient contrast on band1;
  // otherwise fall back to max-contrast override.
  const bodyText = contrastRatio(txt, band1) >= 3.5 ? txt : bestTextOn(band1);

  // Border: darkened accent
  const border = darken(acc, 0.25);

  // ── XML builders ─────────────────────────────────────────────────────────────
  const solid  = (c) => `<a:solidFill><a:srgbClr val="${hex6(c)}"/></a:solidFill>`;
  const noFill = () => `<a:noFill/>`;
  const ln     = (c, w = 12700) =>
    `<a:ln w="${w}"><a:solidFill><a:srgbClr val="${hex6(c)}"/></a:solidFill></a:ln>`;
  const noLn   = () => `<a:ln><a:noFill/></a:ln>`;

  const tcBdrAll = (c) =>
    `<a:tcBdr>` +
    `<a:left>${ln(c)}</a:left><a:right>${ln(c)}</a:right>` +
    `<a:top>${ln(c)}</a:top><a:bottom>${ln(c)}</a:bottom>` +
    `<a:insideH>${ln(c)}</a:insideH><a:insideV>${ln(c)}</a:insideV>` +
    `</a:tcBdr>`;

  const tcBdrBottomOnly = (c, w = 25400) =>
    `<a:tcBdr>` +
    `<a:left>${noLn()}</a:left><a:right>${noLn()}</a:right>` +
    `<a:top>${noLn()}</a:top><a:bottom>${ln(c, w)}</a:bottom>` +
    `<a:insideH>${noLn()}</a:insideH><a:insideV>${noLn()}</a:insideV>` +
    `</a:tcBdr>`;

  const txStyle = (c, bold = false) =>
    `<a:tcTxStyle${bold ? ' b="1"' : ''}>` +
    `<a:fontRef idx="minor"><a:srgbClr val="${hex6(c)}"/></a:fontRef>` +
    `<a:srgbClr val="${hex6(c)}"/>` +
    `</a:tcTxStyle>`;

  const buildStyle = (styleId) =>
    `<a:tblStyle styleId="${styleId}" styleName="Slide2Notes Style">` +
      // Whole table defaults
      `<a:wholeTbl>` +
        txStyle(bodyText) +
        `<a:tcStyle>${solid(bg)}${tcBdrAll(border)}</a:tcStyle>` +
      `</a:wholeTbl>` +
      // Band1H — odd data rows (slightly offset from bg)
      `<a:band1H>` +
        txStyle(bodyText) +
        `<a:tcStyle>${solid(band1)}</a:tcStyle>` +
      `</a:band1H>` +
      // Band2H — even data rows (plain bg)
      `<a:band2H>` +
        txStyle(bodyText) +
        `<a:tcStyle>${solid(band2)}</a:tcStyle>` +
      `</a:band2H>` +
      // First row — header
      `<a:firstRow>` +
        txStyle(hdrText, true) +
        `<a:tcStyle>${solid(acc)}${tcBdrBottomOnly(darken(acc, 0.3))}</a:tcStyle>` +
      `</a:firstRow>` +
      // Last row
      `<a:lastRow>` +
        txStyle(bodyText, true) +
        `<a:tcStyle>${solid(band1)}${tcBdrBottomOnly(border)}</a:tcStyle>` +
      `</a:lastRow>` +
      // First col
      `<a:firstCol>` +
        txStyle(bodyText, true) +
        `<a:tcStyle></a:tcStyle>` +
      `</a:firstCol>` +
      // Last col
      `<a:lastCol>` +
        txStyle(bodyText, true) +
        `<a:tcStyle></a:tcStyle>` +
      `</a:lastCol>` +
    `</a:tblStyle>`;

  const defaultId = styleIds[0] || "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}";
  const stylesXml = [...new Set(styleIds)].map(buildStyle).join("\n  ");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="${defaultId}">\n` +
    `  ${stylesXml}\n` +
    `</a:tblStyleLst>`
  );
}

/**
 * Collect all tableStyleId GUIDs referenced across all slides.
 * @param {JSZip} zip
 * @param {string[]} slidePaths
 * @returns {Promise<string[]>}
 */
async function collectTableStyleIds(zip, slidePaths) {
  const ids = new Set();
  for (const path of slidePaths) {
    const xml = await zip.file(path).async("string");
    for (const m of xml.matchAll(/<a:tableStyleId>(\{[^}]+\})<\/a:tableStyleId>/g)) {
      ids.add(m[1]);
    }
  }
  return [...ids];
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Apply a color theme to an existing .pptx buffer in-place.
 * Text structure, bullets, tables, images, and layout are fully preserved.
 *
 * @param {Buffer} sourceBuffer  Original .pptx bytes
 * @param {{
 *   background: string;  "#RRGGBB" - slide background
 *   accent: string;      "#RRGGBB" - headings / highlights
 *   text: string;        "#RRGGBB" - body text
 *   panel?: string;      "#RRGGBB" - card/panel fill
 * }} newTheme
 * @returns {Promise<Buffer>}
 */
export async function applyThemeToPptx(sourceBuffer, newTheme) {
  const zip = await JSZip.loadAsync(sourceBuffer);

  // ── 1. Patch theme XML (propagates schemeClr references throughout the deck) ─
  const themePaths = Object.keys(zip.files).filter(
    (p) => /^ppt\/theme\/theme\d*\.xml$/i.test(p)
  );

  const newClrScheme = buildClrSchemeXml(newTheme);

  for (const themePath of themePaths) {
    const xml = await zip.file(themePath).async("string");
    zip.file(themePath, patchThemeXml(xml, newClrScheme));
  }

  // ── 2. Detect "old" background from first slide (for shape fill replacement) ─
  const allSlidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)?.[1] || "0");
      const nb = parseInt(b.match(/(\d+)/)?.[1] || "0");
      return na - nb;
    });

  let detectedOldBg = null;
  if (allSlidePaths.length > 0) {
    const firstSlideXml = await zip.file(allSlidePaths[0]).async("string");
    detectedOldBg = extractSlideBgColor(firstSlideXml);
  }

  // Also check slide master for old bg
  const masterPaths = Object.keys(zip.files).filter(
    (p) => /^ppt\/slideMasters\/slideMaster\d*\.xml$/i.test(p)
  );
  let masterOldBg = null;
  if (!detectedOldBg && masterPaths.length > 0) {
    const masterXml = await zip.file(masterPaths[0]).async("string");
    masterOldBg = extractSlideBgColor(masterXml);
  }

  const oldBg = detectedOldBg || masterOldBg || null;
  // If we couldn't detect the old background (e.g. slides used <p:bgRef> instead
  // of an explicit srgbClr), skip shape-fill recoloring entirely.  Falling back
  // to #FFFFFF is dangerous: the newly-written background srgbClr from
  // patchSlideBg would match the white fallback and get re-overwritten to the
  // text color (typically black), producing the "black background" bug.
  const oldTheme = oldBg
    ? {
        background: oldBg,
        accent: oldBg, // conservative: only match bg-colored fills
        panel: oldBg,
      }
    : null;

  // ── 3. Patch each slide: background + shape fills ──────────────────────────
  for (const slidePath of allSlidePaths) {
    let xml = await zip.file(slidePath).async("string");

    // 3a. Slide background
    xml = patchSlideBg(xml, newTheme.background);

    // 3b. Shape fills that match the old background color (skip if undetected)
    if (oldTheme) xml = patchShapeFills(xml, oldTheme, newTheme);

    zip.file(slidePath, xml);
  }

  // ── 4. Patch slide master backgrounds ─────────────────────────────────────
  for (const masterPath of masterPaths) {
    let xml = await zip.file(masterPath).async("string");
    xml = patchSlideBg(xml, newTheme.background);
    if (oldTheme) xml = patchShapeFills(xml, oldTheme, newTheme);
    zip.file(masterPath, xml);
  }

  // ── 5. Patch slide layouts (optional — subtle improvements) ───────────────
  const layoutPaths = Object.keys(zip.files).filter(
    (p) => /^ppt\/slideLayouts\/slideLayout\d*\.xml$/i.test(p)
  );
  for (const layoutPath of layoutPaths) {
    let xml = await zip.file(layoutPath).async("string");
    xml = patchSlideBg(xml, newTheme.background);
    zip.file(layoutPath, xml);
  }

  // ── 6. Inject explicit table style — the definitive fix for invisible text ──
  // Table styles reference built-in Office GUIDs whose colors come from schemeClr.
  // When we retheme, schemeClr updates propagate — but the LLM-chosen text color
  // (dk1/tx1) can become invisible against light-tinted band rows (lt2/accent1).
  // Solution: replace tableStyles.xml with a fully explicit style (all srgbClr,
  // no schemeClr) computed with proper contrast checks against our exact palette.
  const tableStyleIds = await collectTableStyleIds(zip, allSlidePaths);
  const explicitTableStyles = buildExplicitTableStylesXml(tableStyleIds, newTheme);
  if (explicitTableStyles) {
    zip.file("ppt/tableStyles.xml", explicitTableStyles);

    // ── Register tableStyles.xml in [Content_Types].xml ────────────────────
    const ctFile = zip.file("[Content_Types].xml");
    if (ctFile) {
      let ctXml = await ctFile.async("string");
      if (!ctXml.includes("tableStyles.xml")) {
        ctXml = ctXml.replace(
          "</Types>",
          `<Override PartName="/ppt/tableStyles.xml" ` +
          `ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>` +
          `</Types>`
        );
        zip.file("[Content_Types].xml", ctXml);
      }
    }

    // ── Register tableStyles.xml in ppt/_rels/presentation.xml.rels ────────
    const relsPath = "ppt/_rels/presentation.xml.rels";
    const relsFile = zip.file(relsPath);
    if (relsFile) {
      let relsXml = await relsFile.async("string");
      if (!relsXml.includes("tableStyles")) {
        relsXml = relsXml.replace(
          "</Relationships>",
          `<Relationship Id="rIdS2NTableStyles" ` +
          `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" ` +
          `Target="tableStyles.xml"/></Relationships>`
        );
        zip.file(relsPath, relsXml);
      }
    }
  }

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

// ── Theme extractor ───────────────────────────────────────────────────────────

/**
 * Extract the color theme from an existing .pptx file so we can reuse
 * the original design when rebuilding slides in content mode.
 *
 * Reads ppt/theme/theme1.xml and extracts dk1 (text), lt1 (background),
 * and accent1 (accent). Falls back to sensible defaults if not found.
 *
 * @param {Buffer} sourceBuffer  Original .pptx bytes
 * @returns {Promise<{ background: string; accent: string; text: string; panel: string }>}
 */
export async function extractThemeFromPptx(sourceBuffer) {
  try {
    const zip = await JSZip.loadAsync(sourceBuffer);

    // Find theme file
    const themePaths = Object.keys(zip.files).filter(
      (p) => /^ppt\/theme\/theme\d*\.xml$/i.test(p)
    );
    if (themePaths.length === 0) return null;

    const themeXml = await zip.file(themePaths[0]).async("string");

    // Extract named color slots from clrScheme
    function extractSlot(slotName) {
      // Match <a:slotName><a:srgbClr val="RRGGBB"/></a:slotName>
      const re = new RegExp(
        `<a:${slotName}>[\\s\\S]*?<a:srgbClr\\s+val="([0-9A-Fa-f]{6})"`,
        "i"
      );
      const m = themeXml.match(re);
      return m ? `#${m[1].toUpperCase()}` : null;
    }

    const background = extractSlot("lt1") || extractSlot("bg1");
    const text       = extractSlot("dk1") || extractSlot("tx1");
    const accent     = extractSlot("accent1");

    if (!background || !text || !accent) return null;

    // Derive panel color: subtle shift of background
    const bg = parseHex(background);
    if (!bg) return null;
    const lum = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
    const shifted = lum < 128
      ? { r: bg.r + (255 - bg.r) * 0.14, g: bg.g + (255 - bg.g) * 0.14, b: bg.b + (255 - bg.b) * 0.14 }
      : { r: bg.r * 0.93, g: bg.g * 0.93, b: bg.b * 0.93 };
    const panel = `#${toHex6(Math.round(shifted.r), Math.round(shifted.g), Math.round(shifted.b))}`;

    return { background, accent, text, panel };
  } catch (e) {
    console.warn("extractThemeFromPptx failed:", e?.message);
    return null;
  }
}