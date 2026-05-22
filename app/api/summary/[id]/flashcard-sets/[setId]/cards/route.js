import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { insertIndexFromAtPosition } from "@/lib/flashcardOrder";
import {
  FLASHCARD_TX_OPTIONS,
  shiftFlashcardOrdersForInsert,
  touchFlashcardSetUpdatedAt,
} from "@/lib/flashcardDb";
import {
  requireFlashcardSetAccess,
  resolveSetIds,
  fetchFlashcardSetWithCards,
} from "@/lib/flashcardRouteHelpers";

/** POST — add a card to a set */
export async function POST(req, context) {
  try {
    const { summaryId, setId } = await resolveSetIds(context);
    if (!summaryId) {
      return NextResponse.json(
        { error: "Invalid summary id" },
        { status: 400 },
      );
    }
    if (!setId) {
      return NextResponse.json(
        { error: "Invalid flashcard set id" },
        { status: 400 },
      );
    }

    const access = await requireFlashcardSetAccess(summaryId, setId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await req.json().catch(() => ({}));
    const front = String(body?.front ?? "").trim();
    const back = String(body?.back ?? "").trim();
    if (!front || !back) {
      return NextResponse.json(
        { error: "Front and back are required" },
        { status: 400 },
      );
    }

    const cardCount = await prisma.flashcard.count({
      where: { flashcardSetId: setId },
    });

    const insertIdx = insertIndexFromAtPosition(body?.atPosition, cardCount);

    await prisma.$transaction(async (tx) => {
      if (insertIdx < cardCount) {
        await shiftFlashcardOrdersForInsert(tx, setId, insertIdx);
      }
      await tx.flashcard.create({
        data: {
          flashcardSetId: setId,
          front,
          back,
          order: insertIdx,
        },
      });
      await touchFlashcardSetUpdatedAt(tx, setId);
    }, FLASHCARD_TX_OPTIONS);

    const flashcardSet = await fetchFlashcardSetWithCards(setId);
    return NextResponse.json({ success: true, flashcardSet });
  } catch (err) {
    console.error("flashcard-sets/[setId]/cards POST:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
