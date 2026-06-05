export const HIGHLIGHT_CONTEXTS = ["summary", "chat"];

export function normalizeHighlightContext(raw) {
  const s = String(raw ?? "summary")
    .trim()
    .toLowerCase();
  return HIGHLIGHT_CONTEXTS.includes(s) ? s : "summary";
}

export async function assertChatMessageOwnedBySummary(
  prisma,
  { summaryId, userId, messageId },
) {
  const mid = Number(messageId);
  if (!Number.isFinite(mid)) return false;
  const row = await prisma.chatMessage.findFirst({
    where: {
      id: mid,
      thread: { summaryId, userId },
    },
    select: { id: true },
  });
  return Boolean(row);
}
