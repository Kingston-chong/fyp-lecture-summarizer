import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { runChat } from "@/lib/llmServer";
import { uiModelToKey } from "@/lib/improvePptModel";
import { panelFromBackground } from "@/lib/themeColors";

const DEFAULT_THEME = {
  background: "#0f172a",
  accent: "#6366f1",
  text: "#f1f5f9",
};

function normalizeTheme(t) {
  if (!t || typeof t !== "object")
    return { ...DEFAULT_THEME, panel: undefined };
  const background = t.background || DEFAULT_THEME.background;
  const accent = t.accent || DEFAULT_THEME.accent;
  const text = t.text || DEFAULT_THEME.text;

  const panel = t.panel || `#${panelFromBackground(background, accent)}`;

  return { background, accent, text, panel };
}

function slidesFromOriginal(slides) {
  return (slides || []).map((s) => {
    const lines = s.lines?.length ? s.lines : [s.text || ""].filter(Boolean);
    const full = String(s.text || lines.join("\n") || "").trim();
    return {
      index: s.index,
      title: `Slide ${s.index}`,
      lines,
      notes: full
        ? `Speaker notes — full context for readers:\n\n${full.slice(0, 6000)}\n\n(Expand when presenting: define terms, give one example per bullet, and state why this slide matters in the deck.)`
        : "",
    };
  });
}

function compactSlidesForLlm(slidesIn) {
  // Preview only needs enough context to rewrite titles/bullets.
  // Keep payload small to reduce timeouts and malformed/truncated JSON.
  return (slidesIn || [])
    .map((s) => {
      const idx = Number(s?.index);
      const lines = Array.isArray(s?.lines) ? s.lines : [];
      const text = String(s?.text || "").trim();
      return {
        index: Number.isFinite(idx) ? idx : s?.index,
        // cap lines and lengths aggressively for preview prompt size
        lines: lines
          .slice(0, 10)
          .map((l) => String(l).slice(0, 280))
          .filter(Boolean),
        text: text.slice(0, 1200),
      };
    })
    .filter((s) => s.index != null);
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const additiveImprove = body?.additiveImprove !== false;
    const instructions = String(body?.instructions || "").trim();
    const modelLabel = String(body?.model || "Gemini");
    const slidesIn = Array.isArray(body?.slides) ? body.slides : [];
    const adjustments = Array.isArray(body?.adjustments)
      ? body.adjustments
      : [];

    if (!instructions) {
      return NextResponse.json(
        { error: "Instructions are required" },
        { status: 400 },
      );
    }
    if (slidesIn.length === 0) {
      return NextResponse.json(
        { error: "No slides payload. Run Plan first." },
        { status: 400 },
      );
    }

    const modelKey = uiModelToKey(modelLabel);
    if (!modelKey) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    const systemPrompt =
      "You are an expert presentation designer. Output ONLY valid JSON (no markdown fences).";

    const slidesForPrompt = compactSlidesForLlm(slidesIn);
    const additiveHint = additiveImprove
      ? "Additive mode: keep source wording on slides unless the user asked to change it; expand mainly in speaker notes."
      : "Full redesign mode: you may refresh theme and on-slide text for a cohesive preview.";

    const userContent = `Create an improved preview version of a PPT (theme + slide titles + bullets + speaker notes).

Follow the user instructions to decide emphasis: they may want only visuals/theme, only teaching clarity and notes, or both. Do not assume a fixed split.
${additiveHint}

User instructions:
${instructions}

Planned adjustments (may be empty):
${JSON.stringify(adjustments, null, 2)}

Source slides (index, text, lines):
${JSON.stringify(slidesForPrompt, null, 2)}

Return JSON exactly:
{
  "title": "Short presentation title",
  "subtitle": "One line value proposition",
  "theme": { "background":"#RRGGBB", "accent":"#RRGGBB", "text":"#RRGGBB", "panel":"#RRGGBB" },
  "slides": [
    { "index": 1, "title": "Slide title", "lines": ["3-6 substantive bullets"], "notes": "3+ sentences speaker notes when possible (preview)" }
  ],
  "imageQueries": []
}

Rules:
1. Include every source slide index exactly once, in ascending order.
2. notes MUST be present and non-empty for every slide.
3. lines[] must be substantive (each bullet should stand alone).
4. theme.panel must be a subtle contrast from background for readability.
5. Use hex colors with #.`;

    const raw = await runChat(modelKey, null, systemPrompt, [
      { role: "user", content: userContent },
    ]);
    let parsed;
    try {
      parsed = parseJsonFromLlm(raw);
    } catch {
      // Degrade gracefully: still show a preview based on original slides.
      // This avoids blocking the UI when the model returns malformed/truncated JSON.
      const fallbackTheme = normalizeTheme(null);
      const fallbackSlides = slidesFromOriginal(slidesIn);
      return NextResponse.json({
        title: "Improved presentation",
        subtitle: "",
        theme: fallbackTheme,
        slides: fallbackSlides,
        warning:
          "Preview generated from original slides because the AI response was not valid JSON.",
      });
    }

    const theme = additiveImprove
      ? {
          background: "#f8fafc",
          accent: "#64748b",
          text: "#0f172a",
          panel: `#${panelFromBackground("#f8fafc", "#64748b")}`,
        }
      : normalizeTheme(parsed?.theme);
    const title = String(parsed?.title || "Improved presentation").slice(
      0,
      200,
    );
    const subtitle = additiveImprove
      ? ""
      : String(parsed?.subtitle || "").slice(0, 300);

    let outSlides = Array.isArray(parsed?.slides) ? parsed.slides : [];
    if (outSlides.length === 0) {
      outSlides = slidesFromOriginal(slidesIn);
    }

    outSlides = outSlides
      .map((s) => ({
        index: Number(s.index),
        title: String(s.title || `Slide ${s.index}`).slice(0, 200),
        lines: Array.isArray(s.lines)
          ? s.lines.map((l) => String(l).slice(0, 300)).filter(Boolean)
          : [],
        notes: String(s.notes || "").slice(0, 6000),
      }))
      .filter((s) => Number.isFinite(s.index) && s.index > 0)
      .sort((a, b) => a.index - b.index);

    for (const s of outSlides) {
      if (!s.notes.trim()) {
        const src = slidesIn.find((x) => Number(x.index) === s.index);
        const fallback =
          src?.text || src?.lines?.join("\n") || s.lines.join("\n");
        s.notes =
          String(fallback || "").trim() ||
          `Expand when presenting: explain each bullet on "${s.title}" and connect the takeaway to the deck.`;
      }
    }

    return NextResponse.json({
      title,
      subtitle,
      theme,
      slides: outSlides,
    });
  } catch (err) {
    console.error("improve-ppt preview:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
