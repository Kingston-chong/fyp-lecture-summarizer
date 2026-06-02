import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { getRoleProfile, normalizeSummarizeRole } from "@/lib/roleProfiles";
import {
  parseTwoSlidesPage,
  submitTwoSlidesGeneration,
} from "@/lib/twoSlidesGenerate";
import { logger } from "@/lib/logger";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { ALAI_BASE, alaiErrorPayload, getAlaiApiKey } from "@/lib/alaiClient";

const parsedMaxPrompt = Number.parseInt(
  process.env.SLIDES_MAX_USER_PROMPT_CHARS || "4000",
  10,
);
const MAX_SLIDE_USER_PROMPT_CHARS =
  Number.isFinite(parsedMaxPrompt) && parsedMaxPrompt > 0
    ? parsedMaxPrompt
    : 4000;

const ALAI_IMAGE_STYLES = new Set([
  "auto",
  "realistic",
  "artistic",
  "cartoon",
  "three_d",
  "custom",
]);

/** @param {unknown} maxSlides */
function toSlideRange(maxSlides) {
  const n = Number.parseInt(String(maxSlides ?? ""), 10);
  if (!n || n < 1) return "auto";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  if (n <= 10) return "6-10";
  if (n <= 15) return "11-15";
  if (n <= 20) return "16-20";
  if (n <= 25) return "21-25";
  return "26-50";
}

/**
 * Style and audience guidance for Alai `additional_instructions` (not raw content).
 * @param {Record<string, unknown>} body
 * @param {ReturnType<typeof getRoleProfile>} roleProfile
 */
function buildAlaiAdditionalInstructions(body, roleProfile) {
  const lines = [];

  const audienceBits = [`Audience: ${roleProfile.label}`];
  if (body.textStyle) audienceBits.push(`${String(body.textStyle)} tone`);
  if (body.strictness === "Strict") {
    audienceBits.push("strict fidelity to source");
  } else if (body.strictness === "Flexible") {
    audienceBits.push("flexible fidelity; may add relevant context");
  }
  lines.push(`${audienceBits.join(". ")}.`);

  const roleLines = roleProfile.slideInstructions
    .map((line) => `- ${line}`)
    .join("\n");
  if (roleLines) {
    lines.push(`Role guidance:\n${roleLines}`);
  }

  if (body.slideLength) {
    lines.push(`Slide length: ${String(body.slideLength)}.`);
  }

  if (body.highlightDefs === true) {
    lines.push(
      "Formatting: Call out important definitions and technical terms on slides.",
    );
  }
  if (body.boldKeywords === true) {
    lines.push("Formatting: Bold or otherwise emphasize essential keywords.");
  }
  if (body.speakerNotes === true) {
    lines.push(
      "Include detailed speaker notes for every slide (minimum 2 sentences each).",
    );
  }

  const bl = String(body?.bulletLimit ?? "").trim();
  if (bl) {
    lines.push(`Bullet budget: at most ${bl} bullet points per slide.`);
  }

  const userExtra = String(body?.slideUserPrompt || body?.userPrompt || "")
    .trim()
    .slice(0, MAX_SLIDE_USER_PROMPT_CHARS);
  if (userExtra) {
    lines.push(`Additional user instructions:\n${userExtra}`);
  }

  return lines.join("\n").trim();
}

/**
 * 2slides Fast PPT `userInput` — only fields the API accepts as text guidance.
 * @param {Record<string, unknown>} body
 * @param {ReturnType<typeof getRoleProfile>} roleProfile
 */
function buildTwoSlidesInputText(body, roleProfile) {
  const parts = [];

  const deckTitle = String(body?.title || "").trim();
  if (deckTitle) parts.push(`Presentation title: ${deckTitle}`);

  const page = parseTwoSlidesPage(body?.maxSlides);
  if (page > 0) {
    parts.push(
      `Target slide count: approximately ${page} slides. Do not exceed ${page + 1} slides.`,
    );
  }

  const roleLines = roleProfile.slideInstructions
    .map((line) => `- ${line}`)
    .join("\n");
  if (roleLines) {
    parts.push(`Role guidance:\n${roleLines}`);
  }

  const userExtra = String(body?.slideUserPrompt || body?.userPrompt || "")
    .trim()
    .slice(0, MAX_SLIDE_USER_PROMPT_CHARS);
  if (userExtra) {
    parts.push(`Additional user instructions:\n${userExtra}`);
  }

  const summary = String(body.summaryText || "").trim();
  if (summary) parts.push(`Summary:\n${summary}`);
  return parts.join("\n\n");
}

/** @param {unknown} style */
function normalizeAlaiImageStyle(style) {
  const s = String(style || "auto")
    .trim()
    .toLowerCase();
  return ALAI_IMAGE_STYLES.has(s) ? s : "auto";
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

    if (provider === "alai") {
      const alaiKey = getAlaiApiKey();
      if (!alaiKey) {
        return NextResponse.json(
          {
            error:
              "ALAI_API_KEY is not configured. Add a valid key from app.getalai.com to .env.local and restart the dev server.",
            code: "ALAI_NOT_CONFIGURED",
          },
          { status: 500 },
        );
      }

      const additionalInstructions = buildAlaiAdditionalInstructions(
        { ...body, summaryText },
        roleProfile,
      );

      const vibeId = String(body?.vibeId || "").trim();

      // num_image_variants: 0 = no creative variants, 1-2 = AI image-led variants.
      // If the user supplied a value, clamp it to [0, 2].
      // If a vibe is set it requires >= 1, so floor at 1 in that case.
      let numImageVariants = 0;
      const rawVariants = body?.numImageVariants;
      if (rawVariants !== undefined && rawVariants !== null) {
        const parsed = Number.parseInt(String(rawVariants), 10);
        if (Number.isFinite(parsed)) {
          numImageVariants = Math.min(Math.max(parsed, 0), 2);
        }
      }
      if (vibeId && numImageVariants < 1) numImageVariants = 1;

      const imageOptions = {
        include_ai_images: body?.includeAiImages !== false,
        include_web_images: body?.includeWebImages !== false,
        style: normalizeAlaiImageStyle(body?.imageStyle),
        num_image_variants: numImageVariants,
      };

      // image_ids: UUIDs returned by POST /api/generate-slides/upload-images
      const rawImageIds = Array.isArray(body?.imageIds) ? body.imageIds : [];
      const imageIds = rawImageIds
        .map((id) => String(id).trim())
        .filter(Boolean);

      const presentationOptions = {
        ...(body?.title ? { title: String(body.title) } : {}),
        ...(body?.themeId ? { theme_id: String(body.themeId) } : {}),
        slide_range: toSlideRange(body?.maxSlides),
      };

      const alaiLanguage = String(body?.alaiLanguage || "").trim();
      const payload = {
        input_text: summaryText,
        additional_instructions: additionalInstructions || undefined,
        export_formats: ["link", "ppt", "pdf"],
        presentation_options: {
          ...presentationOptions,
          ...(vibeId ? { vibe_id: vibeId } : {}),
        },
        image_options: imageOptions,
        ...(imageIds.length > 0 ? { image_ids: imageIds } : {}),
        ...(alaiLanguage ? { text_options: { language: alaiLanguage } } : {}),
      };

      const res = await fetch(`${ALAI_BASE}/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${alaiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const { message, httpStatus } = alaiErrorPayload(res, data);
        logger.error("generate-slides", "Alai POST /generations failed", {
          status: res.status,
          message,
        });
        return NextResponse.json(
          {
            error: message,
            code: "ALAI_UPSTREAM",
            provider: "alai",
            upstreamStatus: res.status,
          },
          { status: httpStatus },
        );
      }

      const generationId = data.id || data.generation_id;
      return NextResponse.json({
        generation_id: generationId,
        provider: "alai",
      });
    }

    const themeId = String(body?.themeId || "").trim();
    if (!themeId) {
      return NextResponse.json(
        {
          error:
            "A theme is required for 2slides. Search and select a theme before generating.",
        },
        { status: 400 },
      );
    }

    const twoSlidesInput = buildTwoSlidesInputText(
      { ...body, summaryText },
      roleProfile,
    );

    const result = await submitTwoSlidesGeneration({
      inputText: twoSlidesInput,
      themeId,
      responseLanguage:
        String(body?.responseLanguage || "Auto").trim() || "Auto",
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
