import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { parsePptxBufferToSlides } from "@/lib/improvePptParse";
import { runImprovePlanAdjustments } from "@/lib/improvePptPlanLlm";
import { uiModelToKey } from "@/lib/improvePptModel";

async function respondWithPlan({ instructions, modelKey, slides }) {
  let adjustments;
  try {
    adjustments = await runImprovePlanAdjustments(
      modelKey,
      instructions,
      slides,
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "The model did not return valid JSON. Try again or switch model.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    instructions,
    model: modelKey,
    slides,
    adjustments,
  });
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      const instructions = String(body?.instructions || "").trim();
      const modelLabel = String(body?.model || "Gemini");
      const slidesIn = Array.isArray(body?.slides) ? body.slides : [];

      if (slidesIn.length === 0) {
        return NextResponse.json(
          { error: "slides array is required and must not be empty" },
          { status: 400 },
        );
      }

      if (!instructions) {
        return NextResponse.json(
          { error: "Instructions are required" },
          { status: 400 },
        );
      }

      const modelKey = uiModelToKey(modelLabel);
      if (!modelKey) {
        return NextResponse.json({ error: "Invalid model" }, { status: 400 });
      }

      const slides = slidesIn.map((s) => ({
        index: Number(s.index),
        text: String(s.text || ""),
        lines: Array.isArray(s.lines) ? s.lines.map((l) => String(l)) : [],
      }));

      return respondWithPlan({ instructions, modelKey, slides });
    }

    const form = await req.formData();
    const file = form.get("file");
    const instructions = String(form.get("instructions") || "").trim();
    const modelLabel = String(form.get("model") || "Gemini");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const name = file.name || "upload.pptx";
    if (!/\.pptx$/i.test(name)) {
      return NextResponse.json(
        {
          error:
            "Only .pptx files are supported. Convert .ppt to .pptx in PowerPoint first.",
        },
        { status: 400 },
      );
    }

    if (!instructions) {
      return NextResponse.json(
        { error: "Instructions are required" },
        { status: 400 },
      );
    }

    const modelKey = uiModelToKey(modelLabel);
    if (!modelKey) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const slides = await parsePptxBufferToSlides(buf);

    return respondWithPlan({ instructions, modelKey, slides });
  } catch (err) {
    console.error("improve-ppt plan:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
