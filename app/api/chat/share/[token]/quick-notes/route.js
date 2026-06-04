import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePublicChatSnapshot } from "@/lib/chatShareSnapshot";
import { generateRevisionSheetMarkdown } from "@/lib/generateRevisionSheetMarkdown";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";

/** Public: generate quick revision notes from a shared chat snapshot. */
export async function POST(_req, context) {
  try {
    const resolved = await Promise.resolve(context?.params);
    const token = String(resolved?.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const rateLimited = await applyLlmRateLimit(
      "share-quick-notes",
      `share:${token}`,
    );
    if (rateLimited) return rateLimited;

    const share = await prisma.chatShare.findFirst({
      where: { shareToken: token, published: true },
      select: { snapshot: true },
    });

    if (!share) {
      return NextResponse.json(
        { error: "This shared chat is not available." },
        { status: 404 },
      );
    }

    const snapshot = parsePublicChatSnapshot(share.snapshot);
    if (!snapshot?.summaryOutput?.trim()) {
      return NextResponse.json(
        { error: "This shared chat has no summary content." },
        { status: 400 },
      );
    }

    const { markdown, title } = await generateRevisionSheetMarkdown({
      title: snapshot.title,
      model: snapshot.model,
      summarizeFor: snapshot.summarizeFor,
      sourceText: snapshot.summaryOutput,
    });

    return NextResponse.json({ markdown, title });
  } catch (err) {
    const msg = err?.message || "Failed to generate quick notes";
    const status =
      msg.includes("student summaries only") ||
      msg.includes("no content")
        ? 400
        : 500;
    console.error("share quick-notes POST:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
