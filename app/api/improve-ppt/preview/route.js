import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
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
  if (!t || typeof t !== "object") return { ...DEFAULT_THEME, panel: undefined };
  const background = t.background || DEFAULT_THEME.background;
  const accent = t.accent || DEFAULT_THEME.accent;
  const text = t.text || DEFAULT_THEME.text;

  const panel =
    t.panel ||
    `#${panelFromBackground(background, accent)}`;

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

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const mode = body?.mode === "style" ? "style" : "context";
    const instructions = String(body?.instructions || "").trim();
    const modelLabel = String(body?.model || "Gemini");
    const slidesIn = Array.isArray(body?.slides) ? body.slides : [];
    const adjustments = Array.isArray(body?.adjustments) ? body.adjustments : [];

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

    const systemPrompt =
      "You are an expert presentation designer. Output ONLY valid JSON (no markdown fences).";

    const userContent = `Create an improved preview version of a PPT (theme + slide titles + bullets + speaker notes).

Mode: ${mode}
User instructions:
${instructions}

Planned adjustments (may be empty):
${JSON.stringify(adjustments, null, 2)}

Source slides (index, text, lines):
${JSON.stringify(slidesIn, null, 2)}

Return JSON exactly:
{
  "title": "Short presentation title",
  "subtitle": "One line value proposition",
  "theme": { "background":"#RRGGBB", "accent":"#RRGGBB", "text":"#RRGGBB", "panel":"#RRGGBB" },
  "slides": [
    { "index": 1, "title": "Slide title", "lines": ["3-6 substantive bullets"], "notes": "2-5 sentences speaker notes" }
  ],
  "imageQueries": []
}

Rules:
1. Include every source slide index exactly once, in ascending order.
2. notes MUST be present and non-empty for every slide.
3. lines[] must be substantive (each bullet should stand alone).
4. theme.panel must be a subtle contrast from background for readability.
5. Use hex colors with #.`;

    const raw = await runChat(modelKey, null, systemPrompt, [{ role: "user", content: userContent }]);
    let parsed;
    try {
      parsed = parseJsonFromLlm(raw);
    } catch {
      return NextResponse.json(
        { error: "The model did not return valid JSON. Try again." },
        { status: 502 }
      );
    }

    const theme = normalizeTheme(parsed?.theme);
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
        lines: Array.isArray(s.lines) ? s.lines.map((l) => String(l).slice(0, 300)).filter(Boolean) : [],
        notes: String(s.notes || "").slice(0, 6000),
      }))
      .filter((s) => Number.isFinite(s.index) && s.index > 0)
      .sort((a, b) => a.index - b.index);

    for (const s of outSlides) {
      if (!s.notes.trim()) {
        const src = slidesIn.find((x) => Number(x.index) === s.index);
        const fallback = src?.text || src?.lines?.join("\n") || s.lines.join("\n");
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
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

