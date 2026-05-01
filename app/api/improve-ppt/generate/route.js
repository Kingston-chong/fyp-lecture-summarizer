import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { fetchVercelBlobBuffer } from "@/lib/fetchVercelBlobBuffer";
import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { runChat } from "@/lib/llmServer";
import { uiModelToKey } from "@/lib/improvePptModel";
import { extractThemeFromPptx } from "@/lib/pptxThemePatch";
import { fetchUnsplashImageUrl } from "@/lib/unsplashStock";
import { fetchRemoteImageBuffer } from "@/lib/fetchRemoteImage";
import { buildStockPhotoQueryFromSlide } from "@/lib/improvePptStockKeywords";
import { panelFromBackground } from "@/lib/themeColors";
import { enrichSlidesWithWebSearch, buildEnrichmentBlock } from "@/lib/improvePptWebSearch";
import { selectSafeTemplateSpec } from "@/lib/improvePptTemplateSpecGuard";
import {
  generatePptxWithTwoSlides,
  improvedSlidesToTwoSlidesUserInput,
} from "@/lib/twoSlidesGenerate";
import {
  BUILTIN_SPECS,
  selectBuiltinSpec,
  buildTemplateSpecPrompt,
  TEMPLATE_SPEC_SYSTEM_PROMPT,
  normalizeTemplateSpec,
} from "@/lib/pptxTemplateSpec";


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
  return String(sourceName || "")
    .replace(/\.(pptx|pdf)$/i, "")
    .trim()
    .slice(0, 200);
}

async function fetchStockImageUrlForQuery(query) {
  const q = String(query || "").trim();
  if (!q || !process.env.UNSPLASH_ACCESS_KEY) return null;
  return fetchUnsplashImageUrl(q);
}

/**
 * Resolve the best template spec for content mode.
 * 1. Try to find a curated built-in by keyword/theme match.
 * 2. If no good match AND the request sounds creative/unusual, ask the LLM.
 * 3. Fallback: use the best built-in.
 *
 * Returns a spec object compatible with pptxTemplateSpec.BUILTIN_SPECS format.
 */
async function resolveTemplateSpec(modelKey, theme, instructions) {
  // Try built-in first — fast and reliable
  const builtinKey = selectBuiltinSpec(theme, instructions);
  const builtin = BUILTIN_SPECS[builtinKey] ?? BUILTIN_SPECS.diagonal_burst;

  // Generate a custom LLM spec if the request contains creative keywords
  // suggesting the user wants something unique beyond the built-ins
  const wantsCustom = /custom|unique|creative|special|unusual|design|artistic|different|original|innovative|futur|retro|vintage|fantasy|sci.?fi|abstract|minimal|luxur|elegant/i.test(instructions);

  if (!wantsCustom) return { spec: builtin, key: builtinKey, source: "builtin" };

  try {
    const raw = await runChat(
      modelKey,
      null,
      TEMPLATE_SPEC_SYSTEM_PROMPT,
      [{ role: "user", content: buildTemplateSpecPrompt(instructions, theme) }]
    );
    const parsed = parseJsonFromLlm(raw);
    const normalized = normalizeTemplateSpec(parsed);
    if (normalized.ok && normalized.spec) {
      return { spec: normalized.spec, key: "ai_generated", source: "llm" };
    }
  } catch (e) {
    console.warn("resolveTemplateSpec LLM failed (non-fatal):", e?.message);
  }

  return { spec: builtin, key: builtinKey, source: "builtin_fallback" };
}

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

    const instructions         = String(body?.instructions || "").trim();
    const modelLabel           = String(body?.model || "Gemini");
    const slidesIn             = Array.isArray(body?.slides)      ? body.slides      : [];
    const adjustments          = Array.isArray(body?.adjustments) ? body.adjustments : [];
    const addStockImages       = Boolean(body?.addStockImages);
    const sourceName           = String(body?.sourceName || "").trim();
    const additiveImprove      = body?.additiveImprove !== false;
    const detailLevelRaw       = String(body?.detailLevel || "lecture").toLowerCase();
    const detailLevel          = ["concise","lecture","deep"].includes(detailLevelRaw) ? detailLevelRaw : "lecture";
    // Optional: a pre-extracted templateSpec from /api/improve-ppt/theme-search.
    // When provided, skip resolveTemplateSpec() and use it directly.
    const incomingTemplateSpec = body?.templateSpec && typeof body.templateSpec === "object"
      ? body.templateSpec
      : null;
    const incomingThemeId = String(body?.themeId || "").trim();

    const documentId = Number(body?.documentId);
    const hasUploadedFile =
      sourceFile instanceof Blob &&
      typeof sourceFile.arrayBuffer === "function" &&
      sourceFile.size > 0;
    const useBlobDocument =
      Number.isFinite(documentId) && documentId > 0 && !hasUploadedFile;

    let blobDoc = null;
    if (useBlobDocument) {
      blobDoc = await prisma.document.findFirst({
        where: { id: documentId, userId: user.id },
        select: { url: true, name: true },
      });
      if (!blobDoc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
    }

    const uploadedFileName =
      hasUploadedFile && "name" in sourceFile && sourceFile.name
        ? String(sourceFile.name)
        : "";
    const effectiveSourceName = (
      sourceName ||
      uploadedFileName ||
      blobDoc?.name ||
      ""
    ).trim();

    if (!instructions) return NextResponse.json({ error: "Instructions are required" }, { status: 400 });
    if (!slidesIn.length) return NextResponse.json({ error: "No slides payload. Run Plan first." }, { status: 400 });

    const modelKey = uiModelToKey(modelLabel);
    if (!modelKey) return NextResponse.json({ error: "Invalid model" }, { status: 400 });

    // FIX: Resolve per-model max token limit
    const maxTokens = IMPROVE_PPT_MAX_TOKENS[modelKey] ?? 8192;

    // LLM rebuild with optional web enrichment
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

    const userContent = `You are improving presentation slides.

${detailBlock}
${additiveBlock}

Infer the user's priorities only from their instructions: they may want theme/visual polish, stock imagery, clearer on-slide wording, richer speaker notes, or any combination. Align the JSON you return with that intent (there is no separate "content vs style" mode).

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
      const fromFile = titleFromSourceFilename(effectiveSourceName);
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

    // Try to extract original PPTX theme to preserve its look (PDF has no PPTX theme)
    let effectiveTheme = theme;
    if (additiveImprove && /\.pptx$/i.test(effectiveSourceName)) {
      try {
        let sourceBuffer = null;
        if (hasUploadedFile) {
          sourceBuffer = Buffer.from(await sourceFile.arrayBuffer());
        } else if (useBlobDocument && blobDoc) {
          sourceBuffer = await fetchVercelBlobBuffer(blobDoc.url);
        }
        if (sourceBuffer) {
          const originalTheme = await extractThemeFromPptx(sourceBuffer);
          if (originalTheme) effectiveTheme = originalTheme;
        }
      } catch (e) {
        console.warn("Could not extract original theme, using default:", e?.message);
      }
    }

    // Resolve template spec:
    // Priority 1 — spec passed in from theme-search (2slides-derived), use as-is.
    // Priority 2 — fall back to built-in / LLM-generated spec.
    const resolved = await resolveTemplateSpec(modelKey, effectiveTheme, instructions);
    const builtinFallbackKey = selectBuiltinSpec(effectiveTheme, instructions);
    const builtinFallbackSpec = BUILTIN_SPECS[builtinFallbackKey] ?? BUILTIN_SPECS.diagonal_burst;
    const safeTemplate = selectSafeTemplateSpec({
      incomingSpec: incomingTemplateSpec,
      resolvedSpec: resolved.spec,
      builtinFallback: builtinFallbackSpec,
    });
    const templateSpec = safeTemplate.spec ?? builtinFallbackSpec;

    // ── Build PPTX via 2slides (preferred) ───────────────────────────────────
    // We keep the old templateSpec logic only to (a) choose a 2slides themeId
    // from theme-search metadata and (b) provide a safe fallback if a user
    // didn't pick a 2slides theme.
    const themeIdFromTemplateSpec =
      (incomingTemplateSpec && String(incomingTemplateSpec?._themeId || "").trim()) ||
      (templateSpec && String(templateSpec?._themeId || "").trim()) ||
      "";

    const effectiveThemeId = incomingThemeId || themeIdFromTemplateSpec;

    let buffer;
    if (process.env.TWOSLIDES_API_KEY && effectiveThemeId) {
      const userInput = improvedSlidesToTwoSlidesUserInput({
        title,
        subtitle,
        slides: outSlides,
        references,
      });
      buffer = await generatePptxWithTwoSlides({
        userInput,
        themeId: effectiveThemeId,
        responseLanguage: "Auto",
        mode: "sync",
      });
    } else {
      // If 2slides isn't configured or the user didn't select a 2slides theme,
      // return a clear error so the UI can guide them to pick one.
      const missing = !process.env.TWOSLIDES_API_KEY
        ? "TWOSLIDES_API_KEY is not configured on the server."
        : "No 2slides theme selected. Run Theme Search and pick a template first.";
      return NextResponse.json({ error: missing }, { status: 503 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${editedFilenameFromSource(effectiveSourceName, title)}"`,
      },
    });

  } catch (err) {
    console.error("improve-ppt generate:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}