import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { runChat, normalizeModelKey } from "@/lib/llmServer";
import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";

const MAX_FLASHCARD_SOURCE_CHARS = Number.parseInt(
  process.env.FLASHCARD_MAX_SOURCE_CHARS || "12000",
  10,
);

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimited = await applyLlmRateLimit("flashcard-generate", user.id);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const { summaryId, model, numCards, focusAreas } = body;

    if (!summaryId) {
      return NextResponse.json({ error: "Missing summaryId" }, { status: 400 });
    }

    const summary = await prisma.summary.findFirst({
      where: { id: Number(summaryId), userId: user.id },
      select: { output: true, title: true },
    });

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    const modelKey = normalizeModelKey(model) || "gemini";

    const parsedCount = Number(numCards);
    const autoCardCount =
      numCards == null ||
      numCards === -1 ||
      !Number.isFinite(parsedCount) ||
      parsedCount < 1;
    const cardCountLine = autoCardCount
      ? "Number of flashcards: Auto — pick a reasonable count (for example 10–15) from how much material is in the summary."
      : `Number of flashcards: ${parsedCount}`;

    const systemPrompt = `You are an expert study-aid creator.
Your task is to generate high-quality flashcards based on the provided document summary.

Settings:
- ${cardCountLine}
- Focus areas: ${focusAreas?.join(", ") || "key concepts and definitions"}
- Use only information from the summary (do not invent facts).

Output Format:
You MUST return a JSON array of flashcard objects. Each object must have:
- front: (string) A short question or term.
- back: (string) A concise answer or definition.

Return ONLY the JSON array. Do not include any other text.`;

    const sourceText = String(summary.output || "").slice(
      0,
      MAX_FLASHCARD_SOURCE_CHARS,
    );

    const userPrompt = `Document Title: ${summary.title}

Summary Content:
${sourceText}

Generate the flashcards now.`;

    const aiResponse = await runChat(modelKey, null, systemPrompt, [
      { role: "user", content: userPrompt },
    ]);
    const cards = parseJsonFromLlm(aiResponse);

    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error(
        "Invalid response from AI: Expected a JSON array of flashcards.",
      );
    }

    const normalized = cards
      .map((c, idx) => ({
        front: String(c?.front ?? "").trim(),
        back: String(c?.back ?? "").trim(),
        order: idx,
      }))
      .filter((c) => c.front && c.back);

    if (normalized.length === 0) {
      throw new Error("No valid flashcards in AI response.");
    }

    const flashcardSet = await prisma.flashcardSet.create({
      data: {
        userId: user.id,
        summaryId: Number(summaryId),
        title: `Flashcards for ${summary.title}`,
        settings: {
          model,
          numCards: autoCardCount ? null : parsedCount,
          focusAreas: focusAreas ?? [],
        },
        cards: {
          create: normalized,
        },
      },
      include: {
        cards: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({ success: true, flashcardSet });
  } catch (err) {
    console.error("Flashcard generation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate flashcards" },
      { status: 500 },
    );
  }
}
