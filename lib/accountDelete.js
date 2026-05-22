import { normalizeEmail } from "@/lib/authUtils";

/**
 * Permanently delete a user and owned data (summaries, documents, resets).
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {{ id: number, email: string }} user
 */
export async function deleteUserAndData(tx, user) {
  const summaryRows = await tx.summary.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const summaryIds = summaryRows.map((s) => s.id);

  if (summaryIds.length > 0) {
    await tx.summaryDocument.deleteMany({
      where: { summaryId: { in: summaryIds } },
    });
    await tx.summary.deleteMany({ where: { userId: user.id } });
  }

  await tx.document.deleteMany({ where: { userId: user.id } });
  await tx.passwordReset.deleteMany({
    where: { email: normalizeEmail(user.email) },
  });
  await tx.user.delete({ where: { id: user.id } });
}
