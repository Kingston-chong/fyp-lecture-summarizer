import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getRoleProfile, normalizeSummarizeRole } from "@/lib/roleProfiles";

const parsedMaxPrompt = Number.parseInt(
  process.env.SLIDES_MAX_USER_PROMPT_CHARS || "4000",
  10
);
const MAX_SLIDE_USER_PROMPT_CHARS =
  Number.isFinite(parsedMaxPrompt) && parsedMaxPrompt > 0 ? parsedMaxPrompt : 4000;

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const summaryText = String(body?.summaryText || "").trim();
    const summarizeRole = normalizeSummarizeRole(body?.summarizeFor);
    const roleProfile = getRoleProfile(summarizeRole);
    
    if (!summaryText) {
      return NextResponse.json({ error: "Summary text is required" }, { status: 400 });
    }

    if (!process.env.ALAI_API_KEY) {
      return NextResponse.json({ error: "ALAI_API_KEY is not configured on the server." }, { status: 500 });
    }

    // Combine user preferences into a robust prompt instruction to be sent as input_text
    let instructions = `Create a presentation based on this summary text.\n`;
    instructions += `Audience Mode: ${roleProfile.label}\n`;
    instructions += `Role guidance:\n${roleProfile.slideInstructions
      .map((line) => `- ${line}`)
      .join("\n")}\n`;
    if (body.title) instructions += `Title: ${body.title}\n`;
    if (body.slideLength) instructions += `Length/Detail: ${body.slideLength}\n`;
    if (body.template) instructions += `Preferred Template/Style: ${body.template}\n`;
    if (body.textStyle) instructions += `Tone/Text Style: ${body.textStyle}\n`;
    if (body.maxSlides) instructions += `Max Slides Limit: ${body.maxSlides}\n`;
    if (body.strictness) {
      instructions += `Fidelity to source summary: ${String(body.strictness)}\n`;
    }
    if (body.highlightDefs === true) {
      instructions +=
        "Formatting: Call out important definitions and technical terms on slides (e.g. bold, colored text, or a short callout) so they are easy to spot.\n";
    }
    if (body.boldKeywords === true) {
      instructions +=
        "Formatting: Bold or otherwise emphasize essential keywords and section labels where it helps readability.\n";
    }
    const bl = String(body?.bulletLimit ?? "").trim();
    if (bl) {
      instructions += `Bullet budget: aim for at most ${bl} bullet points per slide unless the summary clearly needs more.\n`;
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
      instructions += `\nAdditional instructions from the user (prioritize when consistent with the summary):\n${userExtra}\n`;
    }

    instructions += `\nSummary:\n${summaryText}`;

    const payload = {
      input_text: instructions,
      // Alai uses export_formats: ['link', 'pdf', 'ppt'].
      // Request 'ppt' so the status endpoint returns a downloadable PPTX URL.
      // Also request 'link' so we can show an in-app preview before download.
      export_formats: ["ppt", "link"],
      presentation_options: body?.title ? { title: String(body.title) } : undefined,
    };

    // Proxy request to Alai API
    const res = await fetch("https://slides-api.getalai.com/api/v1/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ALAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      console.error("Alai API Error:", data);
      return NextResponse.json({ error: data.error || data.message || "Failed to generate slides with Alai API" }, { status: res.status });
    }

    // Some APIs return id, other generation_id
    const generationId = data.id || data.generation_id;
    return NextResponse.json({ generation_id: generationId });
  } catch (err) {
    console.error("generate-slides proxy POST:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
