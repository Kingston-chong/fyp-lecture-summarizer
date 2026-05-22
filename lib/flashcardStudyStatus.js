/** @returns {{ knownIds: Set<number>, unknownIds: Set<number> }} */
export function flashcardRatingsFromCards(cards) {
  const knownIds = new Set();
  const unknownIds = new Set();
  for (const c of cards || []) {
    if (c.studyStatus === "known") knownIds.add(c.id);
    else if (c.studyStatus === "learning") unknownIds.add(c.id);
  }
  return { knownIds, unknownIds };
}
