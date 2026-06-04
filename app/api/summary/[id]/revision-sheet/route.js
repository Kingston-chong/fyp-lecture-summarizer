import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { generateRevisionSheetMarkdown } from "@/lib/generateRevisionSheetMarkdown";

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

    const { markdown, title } = await generateRevisionSheetMarkdown({
      title: summary.title,
      model: summary.model,
      summarizeFor: summary.summarizeFor,
      sourceText,
    });

    return NextResponse.json({ markdown, title });
  } catch (err) {
    const msg = err?.message || "Failed to generate revision sheet";
    if (msg === "Invalid id") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("revision-sheet POST:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
