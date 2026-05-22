import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireFlashcardSetAccess,
  resolveSetIds,
  fetchFlashcardSetWithCards,
} from "@/lib/flashcardRouteHelpers";

/** PUT — reset study progress for all cards in a set */
export async function PUT(_req, context) {
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

    await prisma.flashcard.updateMany({
      where: { flashcardSetId: setId },
      data: { studyStatus: null },
    });
    await prisma.flashcardSet.update({
      where: { id: setId },
      data: { updatedAt: new Date() },
    });

    const flashcardSet = await fetchFlashcardSetWithCards(setId);
    return NextResponse.json({ success: true, flashcardSet });
  } catch (err) {
    console.error("flashcard-sets/.../study-progress PUT:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
