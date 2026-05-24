import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { verifySlideDeckViewToken } from "@/lib/slideDeckViewToken";
import { toBlobRef } from "@/lib/blobRef";

export function safeAsciiFilename(name) {
  return String(name || "presentation")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "");
}

/**
 * Resolve slide-deck access from session cookie or `?t=` view token.
 * @returns {Promise<{ deck: { title: string; pptxUrl: string }; userId: number } | { error: string; status: number }>}
 */
export async function resolveSlideDeckAccess(req, { summaryId, deckId }) {
  if (Number.isNaN(summaryId) || Number.isNaN(deckId)) {
    return { error: "Invalid id", status: 400 };
  }

  const urlObj = new URL(req.url);
  const rawToken = urlObj.searchParams.get("t");
  let userIdForDeck = null;

  if (rawToken) {
    const claims = verifySlideDeckViewToken(rawToken);
    if (
      !claims ||
      claims.summaryId !== summaryId ||
      claims.deckId !== deckId
    ) {
      return { error: "Invalid or expired token", status: 401 };
    }
    userIdForDeck = claims.userId;
  } else {
    const user = await getRequestUser();
    if (!user) return { error: "Unauthorized", status: 401 };
    userIdForDeck = user.id;
  }

  const deck = await prisma.slideDeck.findFirst({
    where: { id: deckId, summaryId, userId: userIdForDeck },
    select: { title: true, pptxUrl: true },
  });
  if (!deck) return { error: "Slide deck not found", status: 404 };

  const blobRef = toBlobRef(deck.pptxUrl);
  if (!blobRef) return { error: "Slide deck file is missing", status: 404 };

  return { deck, userId: userIdForDeck, blobRef };
}

/**
 * Stream PPTX from private blob storage.
 * @param {{ ifNoneMatch?: string }} [opts] — forward browser revalidation for 304.
 */
export async function fetchSlideDeckStream(blobRef, opts = {}) {
  const getOpts = { access: "private", useCache: true };
  if (opts.ifNoneMatch) getOpts.ifNoneMatch = opts.ifNoneMatch;
  return get(blobRef, getOpts);
}
