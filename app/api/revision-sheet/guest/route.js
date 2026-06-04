import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/rateLimit";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { generateRevisionSheetMarkdown } from "@/lib/generateRevisionSheetMarkdown";

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rateLimited = await applyLlmRateLimit(
      "revision-sheet",
      `guest-ip:${ip}`,
    );
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const sourceText = String(body?.output || "").trim();
    if (!sourceText) {
      return NextResponse.json(
        { error: "Summary has no content yet." },
        { status: 400 },
      );
    }

    const summarizeFor = String(body?.summarizeFor || "student");
    if (summarizeFor !== "student") {
      return NextResponse.json(
        {
          error: "Revision sheets are available for student summaries only.",
        },
        { status: 400 },
      );
    }

    const { markdown, title } = await generateRevisionSheetMarkdown({
      title: body?.title || "Revision sheet",
      model: body?.model || "chatgpt",
      summarizeFor,
      sourceText,
    });

    return NextResponse.json({ markdown, title });
  } catch (err) {
    console.error("revision-sheet guest POST:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate revision sheet" },
      { status: 500 },
    );
  }
}
