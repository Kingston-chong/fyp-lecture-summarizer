import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { runChat } from "@/lib/llmServer";
import { uiModelToKey } from "@/lib/improvePptModel";
import { buildImprovedPptx } from "@/lib/pptxGenerate";
import { fetchUnsplashImageUrl } from "@/lib/unsplashStock";
import { panelFromBackground } from "@/lib/themeColors";

const DEFAULT_THEME = {
  background: "#0f172a",
  accent: "#6366f1",
  text: "#f1f5f9",
};

function sanitizeForFilename(s) {
  return String(s || "")
    // Windows-invalid filename chars
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function editedFilenameFromSource(sourceName, fallbackTitle) {
  const src = sanitizeForFilename(sourceName);
  const base = src.replace(/\.[^.]+$/, ""); // strip last extension
  const finalBase = base || sanitizeForFilename(fallbackTitle) || "improved";
  return `${finalBase} (edited).pptx`;
}

async function fetchImageBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function normalizeTheme(t, instructions) {
  const ins = String(instructions || "").toLowerCase();
  const wantsGreen =
    ins.includes("green") ||
    ins.includes("forest") ||
    ins.includes("nature theme");

  let bg = t?.background || DEFAULT_THEME.background;
  let accent = t?.accent || DEFAULT_THEME.accent;
  let text = t?.text || DEFAULT_THEME.text;

  if (wantsGreen && !t?.background) {
    bg = "#0a1f14";
    accent = "#22c55e";
    text = "#ecfdf5";
  }

  const panelFromLlm = String(t?.panel || "").trim();
  const panel =
    panelFromLlm ||
    `#${panelFromBackground(String(bg), String(accent))}`;

  return {
    background: bg,
    accent,
    text,
    panel,
  };
}

function slidesFromOriginal(slides) {
  return slides.map((s) => {
    const lines = s.lines?.length ? s.lines : [s.text || ""].filter(Boolean);
    const full = String(s.text || lines.join("\n") || "").trim();
    return {
      index: s.index,
      title: `Slide ${s.index}`,
      lines,
      notes: full
        ? `Speaker notes — full context for readers:\n\n${full.slice(0, 6000)}\n\n(Expand these when presenting: define terms, give one example per bullet, and state why this slide matters in the deck.)`
        : "",
    };
  });
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const mode = body?.mode === "style" ? "style" : "context";
    const instructions = String(body?.instructions || "").trim();
    const modelLabel = String(body?.model || "Gemini");
    const slidesIn = Array.isArray(body?.slides) ? body.slides : [];
    const adjustments = Array.isArray(body?.adjustments) ? body.adjustments : [];
    const addStockImages = Boolean(body?.addStockImages);
    const sourceName = String(body?.sourceName || "").trim();

    if (!instructions) {
      return NextResponse.json({ error: "Instructions are required" }, { status: 400 });
    }
    if (slidesIn.length === 0) {
      return NextResponse.json({ error: "No slides payload. Run Plan first." }, { status: 400 });
    }

    const modelKey = uiModelToKey(modelLabel);
    if (!modelKey) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    const systemPrompt = `You are an expert presentation designer (similar to polished AI slide tools: cohesive themes, cover slide, readable hierarchy). Output ONLY valid JSON — no markdown, no commentary.`;

    const userContent = `Task: produce data for a professional PowerPoint file with a strong visual theme and rich speaker notes.

Mode: ${mode}
- style = apply a cohesive color theme (e.g. green: dark background + emerald accents), optional imagery; keep wording unless the user asked to change text.
- context = rewrite slide text to be clearer/shorter/precise; still include full speaker notes so readers understand.

User instructions:
${instructions}

Planned adjustments (may be empty):
${JSON.stringify(adjustments, null, 2)}

Source slides (each has index, text, lines):
${JSON.stringify(slidesIn, null, 2)}

Return JSON exactly in this shape:
{
  "title": "Short presentation title",
  "subtitle": "One line value proposition or scope (shown on cover slide)",
  "theme": {
    "background": "#RRGGBB",
    "accent": "#RRGGBB",
    "text": "#RRGGBB",
    "panel": "#RRGGBB"
  },
  "slides": [
    {
      "index": 1,
      "title": "Clear slide title (not generic)",
      "lines": [
        "Each bullet is a full phrase with enough detail to stand alone (not a single word).",
        "Include 3–6 bullets per slide when content allows.",
        "Explain terms briefly in-line where needed."
      ],
      "notes": "2–5 sentences of speaker notes: expand every bullet, define jargon, add one concrete example or implication, and connect this slide to the overall story. Notes must make the deck understandable without you presenting."
    }
  ],
  "imageQueries": [
    { "slideIndex": 1, "query": "short English stock photo search query" }
  ]
}

Strict rules:
1. Include every source slide index exactly once, in ascending order. Never drop a slide.
2. theme.panel = slightly lighter/different from background for card areas (or a subtle contrast); all colors must be hex with #.
3. If the user asks for a green (or any) theme, pick a harmonious palette (dark bg + bright accent + light text); avoid default gray-only unless they asked for minimal.
4. lines[]: substantive content — readers should understand the topic from bullets alone. Avoid empty or fragment bullets.
5. notes: REQUIRED for every slide. This is where you add depth so printed/PDF readers and note-takers understand the story. No empty notes.
6. imageQueries: only if the user asked for photos/images/pictures, or mode is style and visuals help; otherwise []. At most one query per slide.
7. title/subtitle: professional; subtitle summarizes the deck.`;

    const raw = await runChat(modelKey, null, systemPrompt, [
      { role: "user", content: userContent },
    ]);

    let parsed;
    try {
      parsed = parseJsonFromLlm(raw);
    } catch {
      return NextResponse.json(
        { error: "The model did not return valid JSON. Try again." },
        { status: 502 }
      );
    }

    const theme = normalizeTheme(parsed?.theme, instructions);
    const title = String(parsed?.title || "Improved presentation").slice(0, 200);
    const subtitle = String(parsed?.subtitle || "").slice(0, 300);

    let outSlides = Array.isArray(parsed?.slides) ? parsed.slides : [];

    if (outSlides.length === 0) {
      outSlides = slidesFromOriginal(slidesIn);
    }

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
        const fallback = src?.text || s.lines.join("\n");
        s.notes =
          fallback?.trim() ||
          `Expand when presenting: explain each bullet on "${s.title}" in plain language, give one example, and state the takeaway.`;
      }
    }

    const imageQueries = Array.isArray(parsed?.imageQueries) ? parsed.imageQueries : [];

    const images = [];
    const wantImages =
      addStockImages &&
      Boolean(process.env.UNSPLASH_ACCESS_KEY) &&
      imageQueries.length > 0;

    if (wantImages) {
      for (const q of imageQueries) {
        const slideIndex = Number(q?.slideIndex);
        const query = String(q?.query || "").trim();
        if (!Number.isFinite(slideIndex) || slideIndex <= 0 || !query) continue;
        const url = await fetchUnsplashImageUrl(query);
        if (!url) continue;
        const data = await fetchImageBuffer(url);
        if (data) images.push({ slideIndex, data });
      }
    }

    const buffer = await buildImprovedPptx({
      title,
      subtitle,
      theme,
      slides: outSlides,
      images,
    });

    const filename = editedFilenameFromSource(sourceName, title);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("improve-ppt generate:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
