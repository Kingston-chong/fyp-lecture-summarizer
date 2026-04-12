import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { parsePptxToSlides } from "@/lib/pptxSlides";
import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { runChat } from "@/lib/llmServer";
import { uiModelToKey } from "@/lib/improvePptModel";

const MAX_SLIDE_TEXT = 4000;

function truncateSlides(slides) {
  return slides.map((s) => ({
    index: s.index,
    text: String(s.text || "").slice(0, MAX_SLIDE_TEXT),
    lines: (s.lines || []).map((l) => String(l).slice(0, 800)).slice(0, 40),
  }));
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const modeRaw = String(form.get("mode") || "context").toLowerCase();
    const mode = modeRaw === "style" ? "style" : "context";
    const instructions = String(form.get("instructions") || "").trim();
    const modelLabel = String(form.get("model") || "Gemini");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const name = file.name || "upload.pptx";
    if (!/\.pptx$/i.test(name)) {
      return NextResponse.json(
        { error: "Only .pptx files are supported. Convert .ppt to .pptx in PowerPoint first." },
        { status: 400 }
      );
    }

    if (!instructions) {
      return NextResponse.json({ error: "Instructions are required" }, { status: 400 });
    }

    const modelKey = uiModelToKey(modelLabel);
    if (!modelKey) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { slides: rawSlides } = await parsePptxToSlides(buf);
    const slides = truncateSlides(rawSlides);

    const systemPrompt = `You are a presentation planning assistant for Slide2Notes.
You list concrete adjustments to match the user's goals. Output ONLY valid JSON, no markdown outside JSON.`;

    const userContent = `Improvement mode: "${mode}".
- style = visual appearance: colors, themes, images, layout polish (not rewriting meaning).
- context = slide wording: shorter text, clearer bullets, simpler language.

User instructions:
${instructions}

Slides (index, text, lines):
${JSON.stringify(slides, null, 2)}

Return JSON exactly in this shape:
{
  "adjustments": [
    {
      "slideIndex": <number>,
      "type": "style" | "context",
      "description": "<what will change>",
      "before": "<short excerpt from current slide>",
      "after": "<optional: expected outcome or summary>"
    }
  ]
}

Include only slides that need changes. If nothing applies, return { "adjustments": [] }.`;

    const raw = await runChat(modelKey, null, systemPrompt, [
      { role: "user", content: userContent },
    ]);

    let parsed;
    try {
      parsed = parseJsonFromLlm(raw);
    } catch {
      return NextResponse.json(
        { error: "The model did not return valid JSON. Try again or switch model." },
        { status: 502 }
      );
    }

    const adjustments = Array.isArray(parsed?.adjustments) ? parsed.adjustments : [];

    return NextResponse.json({
      mode,
      instructions,
      model: modelKey,
      slides,
      adjustments,
    });
  } catch (err) {
    console.error("improve-ppt plan:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
