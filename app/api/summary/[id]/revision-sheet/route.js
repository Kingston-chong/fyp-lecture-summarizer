import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { runChat, parseSummaryModel } from "@/lib/llmServer";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { REVISION_SHEET_SYSTEM_PROMPT } from "@/lib/revisionSheetPrompt";
import { stripMarkdownFence } from "@/lib/stripMarkdownFence";

const MAX_SOURCE_CHARS = Number.parseInt(
  process.env.REVISION_SHEET_MAX_SOURCE_CHARS || "14000",
  10,
);
const MAX_OUTPUT_TOKENS = Number.parseInt(
  process.env.REVISION_SHEET_MAX_TOKENS || "8192",
  10,
);

async function getSummaryId(params) {
  const resolved = await Promise.resolve(params);
  const id = Number(resolved?.id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid id");
  return id;
}

export async function POST(_req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimited = await applyLlmRateLimit("revision-sheet", user.id);
    if (rateLimited) return rateLimited;

    const summaryId = await getSummaryId(context.params);

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: {
        id: true,
        title: true,
        model: true,
        summarizeFor: true,
        output: true,
      },
    });

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    if (summary.summarizeFor !== "student") {
      return NextResponse.json(
        {
          error:
            "Revision sheets are available for student summaries only.",
        },
        { status: 400 },
      );
    }

    const sourceText = String(summary.output || "").trim();
    if (!sourceText) {
      return NextResponse.json(
        { error: "Summary has no content yet. Wait for generation to finish." },
        { status: 400 },
      );
    }

    const { provider: model, variant } = parseSummaryModel(summary.model);
    if (!model) {
      return NextResponse.json(
        { error: "Summary model is not configured." },
        { status: 400 },
      );
    }

    const userPrompt = `Document title: ${summary.title}

Source material (lecture summary / slide notes):
${sourceText.slice(0, MAX_SOURCE_CHARS)}

Create the full revision study notes document now, including the Quick Q&A section at the end.`;

    const raw = await runChat(
      model,
      variant,
      REVISION_SHEET_SYSTEM_PROMPT,
      [{ role: "user", content: userPrompt }],
      { maxTokens: MAX_OUTPUT_TOKENS },
    );

    const markdown = stripMarkdownFence(raw);
    if (!markdown.trim()) {
      return NextResponse.json(
        { error: "Revision sheet generation returned empty content." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      markdown,
      title: summary.title,
    });
  } catch (err) {
    const msg = err?.message || "Failed to generate revision sheet";
    if (msg === "Invalid id") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("revision-sheet POST:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
