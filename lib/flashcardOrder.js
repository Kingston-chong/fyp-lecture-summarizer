/**
 * Flashcard order helpers (0-based `order` field on Flashcard rows).
 */

/** Clamp 1-based insert position to [1, cardCount + 1]. */
export function clampAtPosition(atPosition, cardCount) {
  const n = Math.max(0, cardCount);
  const raw = Number(atPosition);
  if (!Number.isFinite(raw) || raw < 1) return n + 1;
  if (raw > n + 1) return n + 1;
  return Math.floor(raw);
}

/** 0-based index where a new card should be inserted. */
export function insertIndexFromAtPosition(atPosition, cardCount) {
  return clampAtPosition(atPosition, cardCount) - 1;
}

/** Build { id, order } updates to renumber cards contiguously 0..n-1. */
export function normalizeOrderUpdates(cards) {
  const sorted = [...cards].sort((a, b) => a.order - b.order);
  return sorted.map((c, idx) => ({ id: c.id, order: idx }));
}

/** Validate reorder payload: same IDs as existing cards. */
export function validateReorderIds(existingCards, cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length !== existingCards.length) {
    return false;
  }
  const existing = new Set(existingCards.map((c) => c.id));
  for (const id of cardIds) {
    if (!existing.has(id)) return false;
  }
  return new Set(cardIds).size === cardIds.length;
}
