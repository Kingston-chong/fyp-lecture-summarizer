import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { getRoleProfile, normalizeSummarizeRole } from "@/lib/roleProfiles";
import { submitTwoSlidesGeneration } from "@/lib/twoSlidesGenerate";
import { logger } from "@/lib/logger";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";

const parsedMaxPrompt = Number.parseInt(
  process.env.SLIDES_MAX_USER_PROMPT_CHARS || "4000",
  10,
);
const MAX_SLIDE_USER_PROMPT_CHARS =
  Number.isFinite(parsedMaxPrompt) && parsedMaxPrompt > 0
    ? parsedMaxPrompt
    : 4000;

function buildInstructions(body, roleProfile) {
  let instructions = `Create a presentation based on this summary text.\n`;
  instructions += `Audience Mode: ${roleProfile.label}\n`;
  instructions += `Role guidance:\n${roleProfile.slideInstructions
    .map((line) => `- ${line}`)
    .join("\n")}\n`;

  if (body.title) instructions += `Title: ${body.title}\n`;
  if (body.slideLength) instructions += `Length/Detail: ${body.slideLength}\n`;
  if (body.template)
    instructions += `Preferred Template/Style: ${body.template}\n`;
  if (body.textStyle) instructions += `Tone/Text Style: ${body.textStyle}\n`;
  if (body.maxSlides) instructions += `Max Slides Limit: ${body.maxSlides}\n`;
  if (body.strictness) {
    instructions += `Fidelity to source summary: ${String(body.strictness)}\n`;
  }

  if (body.highlightDefs === true) {
    instructions +=
      "Formatting: Call out important definitions and technical terms on slides.\n";
  }
  if (body.boldKeywords === true) {
    instructions +=
      "Formatting: Bold or otherwise emphasize essential keywords.\n";
  }
  if (body.speakerNotes === true) {
    instructions +=
      "Include detailed speaker notes for every slide (minimum 2 sentences each).\n";
  }

  const bl = String(body?.bulletLimit ?? "").trim();
  if (bl) {
    instructions += `Bullet budget: aim for at most ${bl} bullet points per slide.\n`;
  }
  if (body.fontSize) {
    instructions += `Relative font size preference for body text: ${String(body.fontSize)}\n`;
  }
  if (body.textDensity) {
    instructions += `Layout density / whitespace: ${String(body.textDensity)}\n`;
  }

  const userExtra = String(body?.slideUserPrompt || body?.userPrompt || "")
    .trim()
    .slice(0, MAX_SLIDE_USER_PROMPT_CHARS);
  if (userExtra) {
    instructions += `\nAdditional instructions from the user:\n${userExtra}\n`;
  }

  instructions += `\nSummary:\n${body.summaryText}`;
  return instructions;
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimited = await applyLlmRateLimit("generate-slides", user.id);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const summaryText = String(body?.summaryText || "").trim();
    if (!summaryText) {
      return NextResponse.json(
        { error: "Summary text is required" },
        { status: 400 },
      );
    }

    const provider = String(body?.provider || "alai").toLowerCase();
    if (!["alai", "2slides"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const summarizeRole = normalizeSummarizeRole(body?.summarizeFor);
    const roleProfile = getRoleProfile(summarizeRole);
    const instructions = buildInstructions(
      { ...body, summaryText },
      roleProfile,
    );

    if (provider === "alai") {
      if (!process.env.ALAI_API_KEY) {
        return NextResponse.json(
          { error: "ALAI_API_KEY is not configured on the server." },
          { status: 500 },
        );
      }

      const payload = {
        input_text: instructions,
        export_formats: ["ppt", "link", "pdf"],
        presentation_options: body?.title
          ? { title: String(body.title) }
          : undefined,
      };

      const res = await fetch(
        "https://slides-api.getalai.com/api/v1/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ALAI_API_KEY}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: data.error || data.message || "Alai generation failed" },
          { status: res.status },
        );
      }

      const generationId = data.id || data.generation_id;
      return NextResponse.json({
        generation_id: generationId,
        provider: "alai",
      });
    }

    const result = await submitTwoSlidesGeneration({
      inputText: instructions,
      themeId: body?.themeId || undefined,
      title: body?.title || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      generation_id: result.presentationId,
      provider: "2slides",
    });
  } catch (err) {
    logger.error("generate-slides", err?.message || "POST failed", {
      stack: err?.stack,
    });
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
