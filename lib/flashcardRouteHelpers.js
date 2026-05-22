import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

export async function resolveSummaryId(context) {
  const resolved = await Promise.resolve(context?.params);
  const raw = resolved?.id;
  const id = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export async function resolveSetIds(context) {
  const resolved = await Promise.resolve(context?.params);
  const summaryId = Number.parseInt(String(resolved?.id), 10);
  const setId = Number.parseInt(String(resolved?.setId), 10);
  if (!Number.isFinite(summaryId) || summaryId <= 0)
    return { summaryId: null, setId: null };
  if (!Number.isFinite(setId) || setId <= 0) return { summaryId, setId: null };
  return { summaryId, setId };
}

export async function resolveCardIds(context) {
  const resolved = await Promise.resolve(context?.params);
  const summaryId = Number.parseInt(String(resolved?.id), 10);
  const setId = Number.parseInt(String(resolved?.setId), 10);
  const cardId = Number.parseInt(String(resolved?.cardId), 10);
  if (!Number.isFinite(summaryId) || summaryId <= 0)
    return { summaryId: null, setId: null, cardId: null };
  if (!Number.isFinite(setId) || setId <= 0)
    return { summaryId, setId: null, cardId: null };
  if (!Number.isFinite(cardId) || cardId <= 0)
    return { summaryId, setId, cardId: null };
  return { summaryId, setId, cardId };
}

/**
 * @returns {Promise<{ ok: true, user } | { ok: false, status: number, error: string }>}
 */
export async function requireFlashcardSetAccess(summaryId, setId) {
  const user = await getRequestUser();
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const summary = await prisma.summary.findFirst({
    where: { id: summaryId, userId: user.id },
    select: { id: true },
  });
  if (!summary) {
    return { ok: false, status: 404, error: "Summary not found" };
  }

  const set = await prisma.flashcardSet.findFirst({
    where: { id: setId, summaryId, userId: user.id },
    select: { id: true },
  });
  if (!set) {
    return { ok: false, status: 404, error: "Flashcard set not found" };
  }

  return { ok: true, user };
}

export async function fetchFlashcardSetWithCards(setId) {
  return prisma.flashcardSet.findUnique({
    where: { id: setId },
    include: { cards: { orderBy: { order: "asc" } } },
  });
}
