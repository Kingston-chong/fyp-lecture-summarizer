import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateReorderIds } from "@/lib/flashcardOrder";
import {
  FLASHCARD_TX_OPTIONS,
  applyFlashcardReorder,
  touchFlashcardSetUpdatedAt,
} from "@/lib/flashcardDb";
import {
  requireFlashcardSetAccess,
  resolveSetIds,
  fetchFlashcardSetWithCards,
} from "@/lib/flashcardRouteHelpers";

/** PUT — reorder cards by id list */
export async function PUT(req, context) {
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
    const cardIds = Array.isArray(body?.cardIds)
      ? body.cardIds.map((id) => Number.parseInt(String(id), 10))
      : [];

    const existing = await prisma.flashcard.findMany({
      where: { flashcardSetId: setId },
      select: { id: true, order: true },
    });

    if (!validateReorderIds(existing, cardIds)) {
      return NextResponse.json(
        { error: "Invalid cardIds for reorder" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await applyFlashcardReorder(tx, cardIds);
      await touchFlashcardSetUpdatedAt(tx, setId);
    }, FLASHCARD_TX_OPTIONS);

    const flashcardSet = await fetchFlashcardSetWithCards(setId);
    return NextResponse.json({ success: true, flashcardSet });
  } catch (err) {
    console.error("flashcard-sets/.../cards/reorder PUT:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
