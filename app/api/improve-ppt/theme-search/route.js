import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { runChat } from "@/lib/llmServer";
import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { uiModelToKey } from "@/lib/improvePptModel";
import { normalizeTemplateSpec } from "@/lib/pptxTemplateSpec";

/**
 * GET /api/improve-ppt/theme-search?q=modern+dark+tech&model=Gemini
 * Optional: themeId (+ themeName fallback) — pick that row from the search
 * results for vision extraction instead of always using the first hit.
 * (Fixes UI mismatch when the user clicks a non-top pill.)
 *
 * 1. Calls the 2slides theme search API (free, just needs TWOSLIDES_API_KEY)
 *    to find templates matching the user's query.
 * 2. For the top result, sends its preview image to the LLM (vision) to extract
 *    a pptxGenJS-compatible style spec: colors, layout type, font style.
 * 3. Returns both the raw theme list AND the extracted spec so the generate
 *    route can use it to drive pptxGenJS.
 *
 * ENV required: TWOSLIDES_API_KEY
 */

const TWOSLIDES_BASE = "https://2slides.com";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch theme list from 2slides.
 * Returns array of { id, name, description, tags, themeURL, previewImageUrl }
 */
async function searchTwoSlidesThemes(query, limit = 6) {
  if (!process.env.TWOSLIDES_API_KEY) {
    throw new Error("TWOSLIDES_API_KEY is not configured on the server.");
  }

  const url = new URL(`${TWOSLIDES_BASE}/api/v1/themes/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.TWOSLIDES_API_KEY}`,
    },
    // 10-second timeout — this is a fast read endpoint
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `2slides theme search failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  const data = await res.json();
  // API returns { success: true, data: { total, themes: [...] } }
  const themes = Array.isArray(data?.data?.themes) ? data.data.themes : [];

  // Per the 2slides API docs, the theme object contains only:
  // id, name, description, tags, themeURL
  // There is NO preview image field — themeURL is a link to the theme page, not an image.
  return themes.map((t) => ({
    id: String(t.id || ""),
    name: String(t.name || ""),
    description: String(t.description || ""),
    // tags is an array per the API docs — normalise to a comma string for the UI
    tags: Array.isArray(t.tags) ? t.tags.join(", ") : String(t.tags || ""),
    themeURL: String(t.themeURL || ""),
    // No preview image available from the 2slides API.
    previewImageUrl: null,
  }));
}

/**
 * Fetch the preview image for a theme and return it as a base64 data URL.
 * Used to pass the image to the LLM for visual analysis.
 */
async function fetchPreviewAsBase64(themeId, previewUrl) {
  if (!themeId && !previewUrl) return null;
  try {
    const fallbackUrl = `${TWOSLIDES_BASE}/api/v1/themes/${encodeURIComponent(String(themeId || ""))}/preview`;
    const targetUrl = previewUrl || fallbackUrl;
    const res = await fetch(targetUrl, {
      headers: process.env.TWOSLIDES_API_KEY
        ? { Authorization: `Bearer ${process.env.TWOSLIDES_API_KEY}` }
        : undefined,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${contentType};base64,${b64}`;
  } catch {
    return null;
  }
}

/**
 * Ask the LLM (vision) to look at the template preview image and extract a
 * pptxGenJS-compatible style spec.
 *
 * Returns an object shaped like a pptxTemplateSpec BUILTIN_SPEC entry so it
 * can be passed straight into buildImprovedPptx({ templateSpec }).
 */
async function extractStyleSpecFromPreview(modelKey, theme, previewDataUrl) {
  const systemPrompt =
    "You are a presentation design analyst. Output ONLY valid JSON — no markdown, no extra text.";

  // Build the message — include the image only if we have it
  const imageBlock = previewDataUrl
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: previewDataUrl.split(";")[0].replace("data:", ""),
            data: previewDataUrl.split(",")[1],
          },
        },
      ]
    : [];

  const textBlock = {
    type: "text",
    text: `Analyze this presentation template${previewDataUrl ? " (shown above)" : ""}.
Template name: "${theme.name}"
Description: "${theme.description}"
Tags: "${theme.tags}"

Extract a style spec so pptxGenJS can approximate this design. Be specific and accurate.

Return ONLY this JSON:
{
  "colors": {
    "background": "#RRGGBB",
    "accent": "#RRGGBB",
    "text": "#RRGGBB",
    "panel": "#RRGGBB",
    "titleText": "#RRGGBB"
  },
  "fonts": {
    "title": "font name (e.g. Calibri, Arial, Georgia)",
    "body": "font name"
  },
  "layout": "one of: split-left | split-right | centered | grid | timeline | minimal",
  "style": "one of: dark | light | colorful | minimal | gradient",
  "coverShape": "one of: full-bleed | diagonal | circle | none",
  "hasAccentBar": false,
  "hasIconCircles": false,
  "borderRadius": "one of: none | small | large",
  "summary": "one sentence describing the overall vibe"
}

Rules:
- All colors must be 7-char hex strings (#RRGGBB).
- Choose layout that best matches the template's dominant slide structure.
- If the image is unavailable, infer from the name and tags.`,
  };

  const content = previewDataUrl ? [...imageBlock, textBlock] : textBlock.text;

  // Use a simple text prompt if no image (vision not needed)
  const messages = previewDataUrl
    ? [{ role: "user", content }]
    : [{ role: "user", content: textBlock.text }];

  const raw = await runChat(modelKey, null, systemPrompt, messages, {
    maxTokens: 1024,
  });

  return parseJsonFromLlm(raw);
}

/**
 * Convert the LLM-extracted style spec into the shape expected by
 * pptxTemplateSpec (BUILTIN_SPECS format) so it plugs straight into
 * buildImprovedPptx({ templateSpec }).
 *
 * This is a best-effort approximation — pptxGenJS can't replicate every
 * design detail, but layout, palette, and font style will match.
 */
function buildTemplateSpecFromStyle(styleSpec, theme) {
  const c = styleSpec?.colors || {};
  const bg = c.background || "#0f172a";
  const accent = c.accent || "#6366f1";
  const text = c.text || "#f1f5f9";
  const panel = c.panel || "#1e2d4a";
  const titleText = c.titleText || accent;
  const fontTitle = styleSpec?.fonts?.title || "Calibri";
  const fontBody = styleSpec?.fonts?.body || "Calibri";
  const layout = styleSpec?.layout || "split-left";
  const hasIconCircles = Boolean(styleSpec?.hasIconCircles);

  // Cover slide spec
  const cover = {
    background: bg,
    shapes: [
      // Accent block — top-left colored strip for non-minimal styles
      ...(styleSpec?.coverShape === "diagonal"
        ? [
            {
              type: "rect",
              x: 0,
              y: 0,
              w: 0.35,
              h: 1,
              fill: accent,
              opacity: 0.15,
            },
          ]
        : styleSpec?.coverShape === "full-bleed"
          ? [
              {
                type: "rect",
                x: 0,
                y: 0,
                w: 1,
                h: 1,
                fill: bg,
              },
            ]
          : []),
      // Accent line under title
      {
        type: "rect",
        x: 0.05,
        y: 0.57,
        w: 0.12,
        h: 0.012,
        fill: accent,
      },
    ],
    title: {
      x: 0.05,
      y: 0.32,
      w: 0.85,
      h: 0.21,
      fontSize: 40,
      bold: true,
      color: titleText,
      fontFace: fontTitle,
      align: "left",
      valign: "middle",
    },
    subtitle: {
      x: 0.05,
      y: 0.6,
      w: 0.85,
      h: 0.15,
      fontSize: 18,
      bold: false,
      color: text,
      fontFace: fontBody,
      align: "left",
    },
  };

  // Content slide spec — varies by layout
  const isRightSplit = layout === "split-right";
  const isCentered = layout === "centered";
  const isGrid = layout === "grid";

  const contentX = isRightSplit ? 0.04 : layout === "split-left" ? 0.48 : 0.05;
  const contentW = isCentered ? 0.9 : isGrid ? 0.9 : 0.46;

  const content = {
    background: bg,
    shapes: [
      // Panel background for content area
      {
        type: "rect",
        x: isRightSplit ? 0.5 : 0,
        y: 0,
        w: isCentered || isGrid ? 1 : 0.46,
        h: 1,
        fill: panel,
        opacity: isCentered || isGrid ? 0 : 1,
      },
      // Top accent bar
      {
        type: "rect",
        x: 0,
        y: 0,
        w: 1,
        h: 0.021,
        fill: accent,
      },
    ],
    title: {
      x: 0.04,
      y: 0.1,
      w: 0.91,
      h: 0.14,
      fontSize: 22,
      bold: true,
      color: titleText,
      fontFace: fontTitle,
      align: "left",
      valign: "middle",
    },
    body: {
      x: contentX,
      y: 0.27,
      w: contentW,
      h: 0.64,
      fontSize: 14,
      color: text,
      fontFace: fontBody,
      bullet: !isGrid,
      // Icon circles next to bullets if the template uses them
      bulletType: hasIconCircles ? "circle" : "default",
    },
  };

  const normalized = normalizeTemplateSpec({
    // Metadata so the frontend can display what was used
    _source: "2slides",
    _themeId: theme.id,
    _themeName: theme.name,
    _themeURL: theme.themeURL,
    _summary: styleSpec?.summary || theme.description,
    cover,
    content,
  });

  return normalized.ok ? normalized.spec : null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = String(searchParams.get("q") ?? "").trim();
    const modelLabel = String(searchParams.get("model") ?? "Gemini");
    const limitRaw = parseInt(searchParams.get("limit") ?? "6", 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : 6;
    const themeId = String(searchParams.get("themeId") ?? "").trim();
    const themeName = String(searchParams.get("themeName") ?? "").trim();

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 },
      );
    }

    if (!process.env.TWOSLIDES_API_KEY) {
      return NextResponse.json(
        { error: "TWOSLIDES_API_KEY is not configured on the server." },
        { status: 503 },
      );
    }

    const modelKey = uiModelToKey(modelLabel);
    if (!modelKey) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    // 1. Search 2slides for matching themes
    const themes = await searchTwoSlidesThemes(query, limit);

    if (themes.length === 0) {
      return NextResponse.json({
        themes: [],
        selectedTheme: null,
        templateSpec: null,
        message: "No matching templates found. Try a different search term.",
      });
    }

    // 2. Choose which theme drives vision extraction (default: first hit)
    let chosenTheme = themes[0];
    if (themeId) {
      const inList = themes.find((x) => String(x.id) === themeId);
      if (inList) {
        chosenTheme = inList;
      } else if (themeName) {
        try {
          const wider = Math.max(limit, 15);
          const alt = await searchTwoSlidesThemes(themeName, wider);
          const byId = alt.find((x) => String(x.id) === themeId);
          if (byId) chosenTheme = byId;
        } catch {
          /* keep themes[0] */
        }
      }
    }

    const previewDataUrl = await fetchPreviewAsBase64(
      chosenTheme.id,
      chosenTheme.previewImageUrl,
    );

    // 3. Ask LLM (vision) to extract the style spec from the preview
    let styleSpec = null;
    let templateSpec = null;
    try {
      styleSpec = await extractStyleSpecFromPreview(
        modelKey,
        chosenTheme,
        previewDataUrl,
      );
      templateSpec = buildTemplateSpecFromStyle(styleSpec, chosenTheme);
    } catch (e) {
      console.warn("Style extraction failed (non-fatal):", e?.message);
      // templateSpec stays null — generate route will fall back to built-ins
    }

    return NextResponse.json({
      // All matching themes (for the frontend to display as options)
      themes: themes.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        tags: t.tags,
        themeURL: t.themeURL,
        previewImageUrl: t.previewImageUrl,
      })),
      // Theme used for templateSpec (matches chosen pill when themeId is passed)
      selectedTheme: {
        id: chosenTheme.id,
        name: chosenTheme.name,
        description: chosenTheme.description,
        themeURL: chosenTheme.themeURL,
        previewImageUrl: chosenTheme.previewImageUrl,
      },
      // The extracted style spec — pass this as `templateSpec` in the generate request
      styleSpec,
      templateSpec,
    });
  } catch (err) {
    console.error("improve-ppt theme-search:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
