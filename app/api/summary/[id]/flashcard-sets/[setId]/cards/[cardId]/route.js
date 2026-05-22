import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FLASHCARD_TX_OPTIONS,
  shiftFlashcardOrdersAfterDelete,
  touchFlashcardSetUpdatedAt,
} from "@/lib/flashcardDb";
import {
  requireFlashcardSetAccess,
  resolveCardIds,
  fetchFlashcardSetWithCards,
} from "@/lib/flashcardRouteHelpers";

/** PATCH — update card front/back */
export async function PATCH(req, context) {
  try {
    const { summaryId, setId, cardId } = await resolveCardIds(context);
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
    if (!cardId) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    const access = await requireFlashcardSetAccess(summaryId, setId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const card = await prisma.flashcard.findFirst({
      where: { id: cardId, flashcardSetId: setId },
    });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const front =
      body?.front !== undefined ? String(body.front).trim() : undefined;
    const back =
      body?.back !== undefined ? String(body.back).trim() : undefined;
    const studyStatusRaw = body?.studyStatus;

    let studyStatus;
    if (studyStatusRaw !== undefined) {
      if (studyStatusRaw === null || studyStatusRaw === "") {
        studyStatus = null;
      } else if (studyStatusRaw === "known" || studyStatusRaw === "learning") {
        studyStatus = studyStatusRaw;
      } else {
        return NextResponse.json(
          { error: 'studyStatus must be "known", "learning", or null' },
          { status: 400 },
        );
      }
    }

    if (front !== undefined && !front) {
      return NextResponse.json(
        { error: "Front cannot be empty" },
        { status: 400 },
      );
    }
    if (back !== undefined && !back) {
      return NextResponse.json(
        { error: "Back cannot be empty" },
        { status: 400 },
      );
    }

    await prisma.flashcard.update({
      where: { id: cardId },
      data: {
        ...(front !== undefined ? { front } : {}),
        ...(back !== undefined ? { back } : {}),
        ...(studyStatus !== undefined ? { studyStatus } : {}),
      },
    });
    await prisma.flashcardSet.update({
      where: { id: setId },
      data: { updatedAt: new Date() },
    });

    const flashcardSet = await fetchFlashcardSetWithCards(setId);
    return NextResponse.json({ success: true, flashcardSet });
  } catch (err) {
    console.error("flashcard-sets/.../cards/[cardId] PATCH:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}

/** DELETE — remove a card and renumber */
export async function DELETE(_req, context) {
  try {
    const { summaryId, setId, cardId } = await resolveCardIds(context);
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
    if (!cardId) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    const access = await requireFlashcardSetAccess(summaryId, setId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const card = await prisma.flashcard.findFirst({
      where: { id: cardId, flashcardSetId: setId },
      select: { id: true, order: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.flashcard.delete({ where: { id: cardId } });
      await shiftFlashcardOrdersAfterDelete(tx, setId, card.order);
      await touchFlashcardSetUpdatedAt(tx, setId);
    }, FLASHCARD_TX_OPTIONS);

    const flashcardSet = await fetchFlashcardSetWithCards(setId);
    return NextResponse.json({ success: true, flashcardSet });
  } catch (err) {
    console.error("flashcard-sets/.../cards/[cardId] DELETE:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
