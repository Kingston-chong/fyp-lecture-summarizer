/**
 * Whether a published quiz is open for new shared responses.
 * @param {{ acceptingResponses?: boolean, closesAt?: Date | string | null }} quizSet
 */
export function isQuizAcceptingResponses(quizSet) {
  if (!quizSet?.acceptingResponses) return false;
  if (!quizSet.closesAt) return true;
  const closes = new Date(quizSet.closesAt);
  if (Number.isNaN(closes.getTime())) return true;
  return closes.getTime() > Date.now();
}

/**
 * Auto-close quiz in DB when past closesAt (best-effort).
 */
export async function ensureQuizNotExpired(prisma, quizSet) {
  if (!quizSet?.closesAt || !quizSet?.acceptingResponses) return quizSet;
  const closes = new Date(quizSet.closesAt);
  if (Number.isNaN(closes.getTime()) || closes.getTime() > Date.now()) {
    return quizSet;
  }
  await prisma.quizSet.update({
    where: { id: quizSet.id },
    data: { acceptingResponses: false },
  });
  return { ...quizSet, acceptingResponses: false };
}
