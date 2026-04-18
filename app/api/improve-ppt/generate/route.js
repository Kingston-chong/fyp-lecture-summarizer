import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { runChat } from "@/lib/llmServer";
import { uiModelToKey } from "@/lib/improvePptModel";
import { buildImprovedPptx } from "@/lib/pptxGenerate";
import { applyThemeToPptx, extractThemeFromPptx } from "@/lib/pptxThemePatch";
import { applyMasterTemplate } from "@/lib/pptxMasterTemplate";
import { buildPptxWithImagesInPlace } from "@/lib/pptxInPlaceImages";
import { fetchUnsplashImageUrl } from "@/lib/unsplashStock";
import { fetchRemoteImageBuffer } from "@/lib/fetchRemoteImage";
import { buildStockPhotoQueryFromSlide } from "@/lib/improvePptStockKeywords";
import { panelFromBackground } from "@/lib/themeColors";
import { enrichSlidesWithWebSearch, buildEnrichmentBlock } from "@/lib/improvePptWebSearch";

// ── FIX: Raise the serverless function timeout so Tavily + LLM can finish.
// Without this Next.js kills the function at 60s before any response is sent.
// Set to 300 on Vercel Pro/hobby with fluid compute; lower to 60 if on free plan.
export const maxDuration = 300;

// ── FIX: Per-model output token ceilings.
// The global CHAT_MAX_TOKENS default of 4096 is too small for 20-slide JSON output.
//   deepseek-chat hard ceiling  = 8,000
//   gpt-4o ceiling              = 16,384
//   gemini-2.5-flash ceiling    = 65,535 (but 24,576 leaves room for thinking tokens)
const IMPROVE_PPT_MAX_TOKENS = {
  deepseek: 8000,
  chatgpt:  16384,
  gemini:   24576,
};

const DEFAULT_THEME = {
  background: "#0f172a",
  accent:     "#6366f1",
  text:       "#f1f5f9",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function sanitizeForFilename(s) {
  return String(s || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function editedFilenameFromSource(sourceName, fallbackTitle) {
  const base =
    sanitizeForFilename(sourceName).replace(/\.[^.]+$/, "") ||
    sanitizeForFilename(fallbackTitle) ||
    "improved";
  return `${base} (edited).pptx`;
}

function titleFromSourceFilename(sourceName) {
  return String(sourceName || "").replace(/\.pptx$/i, "").trim().slice(0, 200);
}

async function fetchStockImageUrlForQuery(query) {
  const q = String(query || "").trim();
  if (!q || !process.env.UNSPLASH_ACCESS_KEY) return null;
  return fetchUnsplashImageUrl(q);
}

/**
 * Curated, designer-quality palettes with unique identities.
 * Keys are plain-English labels the LLM can match against.
 * Each palette is guaranteed to have sufficient text contrast on both
 * the background and the band row color (verified manually).
 */
const CURATED_PALETTES = {
  // ── Dark themes ──────────────────────────────────────────────────────────────
  midnight_aurora: {
    keywords: ["aurora", "midnight", "violet", "purple", "dark purple", "galaxy", "cosmic"],
    background: "#0a0e27", accent: "#7c3aed", text: "#e0e7ff", panel: "#131936",
  },
  obsidian_gold: {
    keywords: ["gold", "golden", "luxury", "premium", "elegant", "black gold", "obsidian"],
    background: "#0c0a09", accent: "#d97706", text: "#fef9ec", panel: "#1a1509",
  },
  cyber_noir: {
    keywords: ["cyber", "neon", "hacker", "tech", "matrix", "mint", "futuristic", "dark tech"],
    background: "#0d0d0d", accent: "#00ff9f", text: "#e2e8f0", panel: "#1a1a1a",
  },
  slate_ocean: {
    keywords: ["ocean", "sea", "cyan", "teal", "marine", "aqua", "blue teal", "water"],
    background: "#0f1e2e", accent: "#06b6d4", text: "#e0f7ff", panel: "#162840",
  },
  burnt_amber: {
    keywords: ["amber", "warm", "fire", "orange", "burnt", "autumn", "fall", "copper"],
    background: "#1c1007", accent: "#f59e0b", text: "#fef3c7", panel: "#2a1a0a",
  },
  deep_crimson: {
    keywords: ["red", "crimson", "ruby", "wine", "passion", "bold red", "cardinal"],
    background: "#1a0a0a", accent: "#ef4444", text: "#fef2f2", panel: "#2d1111",
  },
  indigo_space: {
    keywords: ["indigo", "space", "dark blue", "navy", "deep blue", "midnight blue"],
    background: "#0f172a", accent: "#6366f1", text: "#e0e7ff", panel: "#1e2d4a",
  },
  charcoal_rose: {
    keywords: ["rose", "pink", "blush", "feminine", "soft pink", "magenta"],
    background: "#1a0f14", accent: "#f43f5e", text: "#ffe4e6", panel: "#2d1520",
  },
  // ── Light themes ─────────────────────────────────────────────────────────────
  terracotta_desert: {
    keywords: ["terracotta", "desert", "earth", "clay", "warm light", "adobe", "sand"],
    background: "#fdf4ec", accent: "#c2410c", text: "#292524", panel: "#fef3c7",
  },
  arctic_glass: {
    keywords: ["arctic", "ice", "glass", "clean", "minimal", "white", "light blue", "sky"],
    background: "#f0f9ff", accent: "#0284c7", text: "#0c4a6e", panel: "#e0f2fe",
  },
  sakura_bloom: {
    keywords: ["sakura", "japanese", "cherry", "soft", "feminine light", "blush light"],
    background: "#fff1f3", accent: "#e11d48", text: "#1f1315", panel: "#ffe4e8",
  },
  forest_mist: {
    keywords: ["forest", "nature", "green", "botanical", "fresh", "eco", "grass", "leaf"],
    background: "#f6faf5", accent: "#15803d", text: "#14301c", panel: "#ecf7ea",
  },
  warm_parchment: {
    keywords: ["academic", "paper", "parchment", "university", "scholarly", "classic", "vintage"],
    background: "#fdf8f0", accent: "#b45309", text: "#292524", panel: "#fef3c7",
  },
  slate_clean: {
    keywords: ["slate", "corporate", "professional", "gray", "grey", "minimal light", "business"],
    background: "#f8fafc", accent: "#334155", text: "#0f172a", panel: "#e2e8f0",
  },
  // ── Bold / unique ────────────────────────────────────────────────────────────
  matcha_zen: {
    keywords: ["matcha", "zen", "japanese dark", "jade", "lime", "botanical dark"],
    background: "#1a2e1a", accent: "#4ade80", text: "#f0fdf4", panel: "#243324",
  },
  deep_ocean_teal: {
    keywords: ["teal", "emerald", "jewel", "dark teal", "malachite"],
    background: "#0c1a2e", accent: "#14b8a6", text: "#e0f2fe", panel: "#0f2d4a",
  },
};

/**
 * Find the best matching curated palette for a user's style request.
 * Returns the palette object or null if no strong match.
 */
function matchCuratedPalette(instructions) {
  const lower = instructions.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const [, palette] of Object.entries(CURATED_PALETTES)) {
    let score = 0;
    for (const kw of palette.keywords) {
      if (lower.includes(kw)) score += kw.split(" ").length; // longer phrase = higher score
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = palette;
    }
  }

  // Only use curated if we had at least one keyword match
  return bestScore > 0 ? bestMatch : null;
}

/**
 * Ask the LLM to pick a color theme matching the user's style request.
 * Returns { background, accent, text, panel } or null on failure.
 */
async function resolveStyleTheme(modelKey, instructions) {
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || "").trim());

  // ── Try curated palette first ──────────────────────────────────────────────
  const curated = matchCuratedPalette(instructions);
  if (curated) {
    const { keywords: _kw, ...palette } = curated;
    return palette;
  }

  // ── Contrast helpers (used to validate LLM output) ─────────────────────────
  function hexToRgb(hex) {
    const h = hex.replace(/^#/, "");
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  }
  function relativeLuminance(hex) {
    const {r,g,b} = hexToRgb(hex);
    const toLinear = (v) => { const s=v/255; return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4); };
    return 0.2126*toLinear(r)+0.7152*toLinear(g)+0.0722*toLinear(b);
  }
  function contrast(a, b) {
    const la=relativeLuminance(a), lb=relativeLuminance(b);
    return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05);
  }
  function deriveBand1(bgHex) {
    const {r,g,b} = hexToRgb(bgHex);
    const lum = 0.2126*r+0.7152*g+0.0722*b;
    if (lum < 50) return `#${[r,g,b].map(c=>Math.round(c+(255-c)*0.14).toString(16).padStart(2,"0")).join("")}`;
    return `#${[r,g,b].map(c=>Math.round(c*0.93).toString(16).padStart(2,"0")).join("")}`;
  }
  function fixTextContrast(p) {
    const band1 = deriveBand1(p.background);
    const onBg   = contrast(p.text, p.background);
    const onBand = contrast(p.text, band1);
    if (onBg < 4.5 || onBand < 3.5) {
      const {r,g,b} = hexToRgb(p.background);
      const lum = 0.2126*r+0.7152*g+0.0722*b;
      p.text = lum < 128 ? "#f1f5f9" : "#111827";
    }
    return p;
  }

  const systemPrompt =
    `You are a color palette designer. Output ONLY valid JSON — no markdown, no extra text.`;

  const userContent = `The user wants to restyle a presentation.
Their request: "${instructions}"

Pick a beautiful, unique 4-color palette that closely matches the request.
Be bold and creative — avoid generic or muddy palettes.

PALETTE GUIDE:
  background: main slide fill (dark or light)
  accent:     header / highlight color — must stand out on the background
  text:       body text — MUST have high contrast on background (WCAG AA ≥ 4.5:1)
  panel:      card/panel fill — subtle contrast from background

EXAMPLE palettes (use as inspiration, not templates):
  "midnight aurora":    { "background":"#0a0e27","accent":"#7c3aed","text":"#e0e7ff","panel":"#131936" }
  "obsidian gold":      { "background":"#0c0a09","accent":"#d97706","text":"#fef9ec","panel":"#1a1509" }
  "cyber noir":         { "background":"#0d0d0d","accent":"#00ff9f","text":"#e2e8f0","panel":"#1a1a1a" }
  "terracotta desert":  { "background":"#fdf4ec","accent":"#c2410c","text":"#292524","panel":"#fef3c7" }
  "sakura bloom":       { "background":"#fff1f3","accent":"#e11d48","text":"#1f1315","panel":"#ffe4e8" }
  "slate ocean":        { "background":"#0f1e2e","accent":"#06b6d4","text":"#e0f7ff","panel":"#162840" }
  "matcha zen":         { "background":"#1a2e1a","accent":"#4ade80","text":"#f0fdf4","panel":"#243324" }
  "warm parchment":     { "background":"#fdf8f0","accent":"#b45309","text":"#292524","panel":"#fef3c7" }

RULES:
1. All four values must be 7-character hex strings starting with #.
2. text must have ≥ 4.5:1 contrast ratio against background.
3. accent must be visually distinct from background.
4. Create something with personality — not generic corporate gray.

Return ONLY this JSON:
{
  "background": "#RRGGBB",
  "accent":     "#RRGGBB",
  "text":       "#RRGGBB",
  "panel":      "#RRGGBB"
}`;

  try {
    const raw = await runChat(modelKey, null, systemPrompt, [
      { role: "user", content: userContent },
    ], { maxTokens: IMPROVE_PPT_MAX_TOKENS[modelKey] ?? 4096 });
    const parsed = parseJsonFromLlm(raw);
    if (
      isHex(parsed?.background) &&
      isHex(parsed?.accent) &&
      isHex(parsed?.text)
    ) {
      const candidate = {
        background: parsed.background,
        accent:     parsed.accent,
        text:       parsed.text,
        panel:      isHex(parsed?.panel)
          ? parsed.panel
          : `#${panelFromBackground(parsed.background, parsed.accent)}`,
      };
      // Guarantee text is readable on both the background and table band rows
      return fixTextContrast(candidate);
    }
  } catch (e) {
    console.warn("resolveStyleTheme failed:", e?.message);
  }
  return null;
}

/**
 * Normalise theme for content-mode rebuild.
 * Additive: neutral readable light palette.
 * Full redesign: use LLM output or defaults.
 */
function normalizeContentTheme(t, additiveImprove) {
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || "").trim());

  if (additiveImprove) {
    const bg = "#f8fafc", accent = "#334155", text = "#0f172a";
    return { background: bg, accent, text, panel: `#${panelFromBackground(bg, accent)}` };
  }
  const bg     = isHex(t?.background) ? t.background : DEFAULT_THEME.background;
  const accent = isHex(t?.accent)     ? t.accent     : DEFAULT_THEME.accent;
  const text   = isHex(t?.text)       ? t.text       : DEFAULT_THEME.text;
  const panel  = isHex(t?.panel)      ? t.panel      : `#${panelFromBackground(bg, accent)}`;
  return { background: bg, accent, text, panel };
}

function slidesFromOriginal(slides) {
  return slides.map((s) => {
    const lines = s.lines?.length ? s.lines : [s.text || ""].filter(Boolean);
    const full  = String(s.text || lines.join("\n") || "").trim();
    return {
      index: s.index,
      title: `Slide ${s.index}`,
      lines,
      notes: full
        ? `Speaker notes:\n\n${full.slice(0, 6000)}\n\n(Expand when presenting.)`
        : "",
    };
  });
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Parse request ──────────────────────────────────────────────────────────
    let body = {};
    let sourceFile = null;
    const ct = req.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      sourceFile = form.get("file");
      try { body = JSON.parse(String(form.get("payload") || "{}")); } catch { body = {}; }
    } else {
      body = await req.json();
    }

    const mode                 = String(body?.mode || "content").toLowerCase() === "style" ? "style" : "content";
    const instructions         = String(body?.instructions || "").trim();
    const modelLabel           = String(body?.model || "Gemini");
    const slidesIn             = Array.isArray(body?.slides)      ? body.slides      : [];
    const adjustments          = Array.isArray(body?.adjustments) ? body.adjustments : [];
    const addStockImages       = Boolean(body?.addStockImages);
    const sourceName           = String(body?.sourceName || "").trim();
    const additiveImprove      = body?.additiveImprove !== false;
    const preserveOriginalDesign = body?.preserveOriginalDesign === true;
    const detailLevelRaw       = String(body?.detailLevel || "lecture").toLowerCase();
    const detailLevel          = ["concise","lecture","deep"].includes(detailLevelRaw) ? detailLevelRaw : "lecture";

    if (!instructions) return NextResponse.json({ error: "Instructions are required" }, { status: 400 });
    if (!slidesIn.length) return NextResponse.json({ error: "No slides payload. Run Plan first." }, { status: 400 });

    const modelKey = uiModelToKey(modelLabel);
    if (!modelKey) return NextResponse.json({ error: "Invalid model" }, { status: 400 });

    // FIX: Resolve per-model max token limit
    const maxTokens = IMPROVE_PPT_MAX_TOKENS[modelKey] ?? 8192;

    // ══════════════════════════════════════════════════════════════════════════
    // STYLE MODE — in-place OOXML theme patching
    // ══════════════════════════════════════════════════════════════════════════
    if (mode === "style") {
      if (!(sourceFile instanceof Blob)) {
        return NextResponse.json(
          { error: "Original .pptx file is required for style mode. Please re-upload." },
          { status: 400 }
        );
      }

      // 1. Resolve theme
      const theme = await resolveStyleTheme(modelKey, instructions) ?? {
        background: DEFAULT_THEME.background,
        accent:     DEFAULT_THEME.accent,
        text:       DEFAULT_THEME.text,
        panel:      `#${panelFromBackground(DEFAULT_THEME.background, DEFAULT_THEME.accent)}`,
      };

      // 2. Apply theme colors to original PPTX
      const sourceBuffer = Buffer.from(await sourceFile.arrayBuffer());
      let pptxBuffer = await applyThemeToPptx(sourceBuffer, theme);

      // 2b. Inject visual template into slide master
      pptxBuffer = await applyMasterTemplate(pptxBuffer, theme);

      // 3. Optionally inject stock images into corners
      if (addStockImages && process.env.UNSPLASH_ACCESS_KEY) {
        const images = [];
        for (const s of slidesIn) {
          const query = buildStockPhotoQueryFromSlide(s, s);
          if (!query) continue;
          const url  = await fetchStockImageUrlForQuery(query);
          if (!url) continue;
          const data = await fetchRemoteImageBuffer(url);
          if (data) images.push({ slideIndex: s.index, data });
        }

        // User-picked images override auto
        for (const ref of (Array.isArray(body?.userImageRefs) ? body.userImageRefs : [])) {
          const slideIndex = Number(ref?.slideIndex);
          const url        = String(ref?.url || "").trim();
          if (!Number.isFinite(slideIndex) || slideIndex <= 0 || !url) continue;
          const buf = await fetchRemoteImageBuffer(url);
          if (!buf) continue;
          const ix = images.findIndex((im) => im.slideIndex === slideIndex);
          if (ix >= 0) images[ix] = { slideIndex, data: buf };
          else images.push({ slideIndex, data: buf });
        }

        if (images.length > 0) {
          pptxBuffer = await buildPptxWithImagesInPlace(pptxBuffer, images);
        }
      }

      return new NextResponse(pptxBuffer, {
        status: 200,
        headers: {
          "Content-Type":        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="${editedFilenameFromSource(sourceName, titleFromSourceFilename(sourceName))}"`,
        },
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CONTENT MODE — LLM rebuild with web enrichment
    // ══════════════════════════════════════════════════════════════════════════

    // 1. Web enrichment (now runs in parallel — see improvePptWebSearch.js fix)
    let webEnrichment = [], allWebSources = [];
    if (process.env.TAVILY_API_KEY) {
      try {
        const result = await enrichSlidesWithWebSearch(slidesIn);
        webEnrichment = result.enriched;
        allWebSources = result.allSources;
      } catch (e) { console.warn("Web enrichment failed (non-fatal):", e?.message); }
    }

    // 2. Build prompt
    const detailBlock = {
      concise: "Detail level: concise — 2+ bullets per slide; speaker notes ≥2 sentences.",
      deep:    "Detail level: deep — 4–8 bullets; speaker notes ≥5 sentences with definitions, examples, misconceptions.",
      lecture: "Detail level: lecture — 3–6 full-sentence bullets; speaker notes 3–5 sentences with examples.",
    }[detailLevel];

    // FIX: Strengthen additive prompt so LLM adds content instead of cutting it
    const additiveBlock = additiveImprove
      ? `ADDITIVE MODE — strict rules:
1. NEVER remove or shorten any existing bullet. Preserve every original line exactly as written.
2. ADD new bullets after the existing ones. New bullets must start with "→ ".
3. If the user asked for a real-world scenario, add it as one or more "→ " bullets on the relevant slide.
4. Speaker notes must contain the full scenario/example/explanation the user requested.
5. Do NOT change the slide title unless the user explicitly asked to rename it.`
      : `Full redesign: you may refresh all titles, bullets, and structure.`;

    const enrichBlock = buildEnrichmentBlock(webEnrichment);

    const userContent = `You are improving presentation slides for teaching clarity.

${detailBlock}
${additiveBlock}

User instructions: "${instructions}"

Planned adjustments:
${JSON.stringify(adjustments, null, 2)}

${enrichBlock ? `Additional web context per slide — synthesise (don't just copy) into bullets and notes:\n\n${enrichBlock}\n` : ""}
Source slides:
${JSON.stringify(slidesIn, null, 2)}

Return ONLY this JSON (no markdown, no extra text):
{
  "title": "deck title",
  "subtitle": "one-line subtitle (empty string in additive mode)",
  "theme": {
    "background": "#RRGGBB",
    "accent":     "#RRGGBB",
    "text":       "#RRGGBB",
    "panel":      "#RRGGBB"
  },
  "slides": [
    {
      "index": 1,
      "title": "Slide title",
      "lines": ["Full-sentence bullet 1", "Full-sentence bullet 2"],
      "notes": "Speaker notes here — non-empty"
    }
  ],
  "imageQueries": [ { "slideIndex": 1, "query": "stock photo search term" } ]
}

Rules:
1. Include EVERY source slide index exactly once, in ascending order.
2. All theme colors must be valid 7-char hex strings (#RRGGBB).
3. lines[]: each bullet must be a complete phrase.
4. notes: non-empty for every slide.
5. imageQueries: one per slide maximum.`;

    // 3. Call LLM — FIX: pass per-model maxTokens instead of global 4096
    const raw = await runChat(
      modelKey, null,
      "You are an expert presentation designer. Output ONLY valid JSON — no markdown, no extra text.",
      [{ role: "user", content: userContent }],
      { maxTokens }
    );

    let parsed;
    try { parsed = parseJsonFromLlm(raw); }
    catch {
      return NextResponse.json(
        { error: "The model did not return valid JSON. Try again or switch model." },
        { status: 502 }
      );
    }

    // 4. Normalise output
    const theme = normalizeContentTheme(parsed?.theme, additiveImprove);

    let title    = String(parsed?.title    || "Improved presentation").slice(0, 200);
    let subtitle = String(parsed?.subtitle || "").slice(0, 300);
    if (additiveImprove) {
      const fromFile = titleFromSourceFilename(sourceName);
      if (fromFile) title = fromFile;
      subtitle = "";
    }

    let outSlides = Array.isArray(parsed?.slides) ? parsed.slides : [];
    if (!outSlides.length) outSlides = slidesFromOriginal(slidesIn);

    outSlides = outSlides
      .map((s) => ({
        index: Number(s.index),
        title: String(s.title || `Slide ${s.index}`).slice(0, 200),
        lines: Array.isArray(s.lines)
          ? s.lines.map((l) => String(l).slice(0, 2500)).filter(Boolean)
          : [],
        notes: String(s.notes || "").slice(0, 12000),
      }))
      .filter((s) => Number.isFinite(s.index) && s.index > 0)
      .sort((a, b) => a.index - b.index);

    for (const s of outSlides) {
      if (!s.notes.trim()) {
        const src = slidesIn.find((x) => x.index === s.index);
        s.notes = String(src?.text || s.lines.join("\n") || "").trim() ||
          `Expand bullet points on "${s.title}" when presenting.`;
      }
    }

    const imageQueriesFromLlm = Array.isArray(parsed?.imageQueries) ? parsed.imageQueries : [];

    // 5. Fetch stock images
    const images = [];
    if (addStockImages && process.env.UNSPLASH_ACCESS_KEY) {
      const slideToQuery = new Map();
      for (const s of outSlides) {
        const src   = slidesIn.find((x) => Number(x.index) === s.index);
        const fromKw = buildStockPhotoQueryFromSlide(s, src);
        const llmQ   = String(imageQueriesFromLlm.find((q) => Number(q?.slideIndex) === s.index)?.query || "").trim();
        const query  = fromKw || llmQ;
        if (query) slideToQuery.set(s.index, query.slice(0, 120));
      }
      for (const [slideIndex, query] of slideToQuery) {
        const url  = await fetchStockImageUrlForQuery(query);
        if (!url) continue;
        const data = await fetchRemoteImageBuffer(url);
        if (data) images.push({ slideIndex, data });
      }
    }

    for (const ref of (Array.isArray(body?.userImageRefs) ? body.userImageRefs : [])) {
      const slideIndex = Number(ref?.slideIndex);
      const url        = String(ref?.url || "").trim();
      if (!Number.isFinite(slideIndex) || slideIndex <= 0 || !url) continue;
      const buf = await fetchRemoteImageBuffer(url);
      if (!buf) continue;
      const ix = images.findIndex((im) => im.slideIndex === slideIndex);
      if (ix >= 0) images[ix] = { slideIndex, data: buf };
      else images.push({ slideIndex, data: buf });
    }

    // 6. Build PPTX
    // FIX: Removed patchPptxTextContent — it cannot add new slides (only patch existing ones),
    // which means requests like "add a scenario slide" were broken by design.
    //
    // Correct approach for additiveImprove:
    //   - The LLM already returns the correct slides[] including any new ones
    //   - We use buildImprovedPptx (full rebuild) for all content mode requests
    //   - BUT if the original file was uploaded, we extract its theme colors first
    //     so the rebuilt deck matches the original design as closely as possible
    const references = allWebSources.map((s) => ({ title: s.title, url: s.url }));

    // Try to extract original file's theme to preserve its look
    let effectiveTheme = theme;
    if (additiveImprove && sourceFile instanceof Blob) {
      try {
        const sourceBuffer = Buffer.from(await sourceFile.arrayBuffer());
        const originalTheme = await extractThemeFromPptx(sourceBuffer);
        if (originalTheme) effectiveTheme = originalTheme;
      } catch (e) {
        console.warn("Could not extract original theme, using default:", e?.message);
      }
    }

    const buffer = await buildImprovedPptx({
      title, subtitle, theme: effectiveTheme,
      slides: outSlides,
      images,
      skipCoverSlide: additiveImprove,
      references,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${editedFilenameFromSource(sourceName, title)}"`,
      },
    });

  } catch (err) {
    console.error("improve-ppt generate:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}