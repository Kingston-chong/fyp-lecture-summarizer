/** Prisma interactive transaction defaults (remote DB can exceed 5s on many row updates). */
export const FLASHCARD_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
};

/**
 * Shift card orders up by 1 at/after insertIdx (0-based). Single UPDATE, not N round-trips.
 */
export async function shiftFlashcardOrdersForInsert(
  tx,
  flashcardSetId,
  insertIdx,
) {
  await tx.$executeRaw`
    UPDATE Flashcard
    SET \`order\` = \`order\` + 1
    WHERE flashcardSetId = ${flashcardSetId} AND \`order\` >= ${insertIdx}
  `;
}

/**
 * After deleting a card with contiguous orders 0..n-1, decrement orders above the gap.
 */
export async function shiftFlashcardOrdersAfterDelete(
  tx,
  flashcardSetId,
  deletedOrder,
) {
  await tx.$executeRaw`
    UPDATE Flashcard
    SET \`order\` = \`order\` - 1
    WHERE flashcardSetId = ${flashcardSetId} AND \`order\` > ${deletedOrder}
  `;
}

/** Apply new order indices in parallel (one round-trip batch). */
export async function applyFlashcardReorder(tx, cardIds) {
  await Promise.all(
    cardIds.map((id, order) =>
      tx.flashcard.update({
        where: { id },
        data: { order },
      }),
    ),
  );
}

export async function touchFlashcardSetUpdatedAt(tx, setId) {
  await tx.flashcardSet.update({
    where: { id: setId },
    data: { updatedAt: new Date() },
  });
}
