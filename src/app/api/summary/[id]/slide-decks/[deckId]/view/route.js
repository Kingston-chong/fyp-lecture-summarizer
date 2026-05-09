import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { verifySlideDeckViewToken } from "@/lib/slideDeckViewToken";

function safeAsciiFilename(name) {
  return String(name || "presentation")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "");
}

/**
 * Stream a stored slide deck for inline viewing (Office embed/new tab).
 * Auth: session cookie, OR `?t=` HMAC token (for Microsoft Office Online viewer fetch).
 */
export async function GET(req, context) {
  try {
    const params = await Promise.resolve(context.params);
    const summaryId = parseInt(String(params?.id ?? ""), 10);
    const deckId = parseInt(String(params?.deckId ?? ""), 10);
    if (Number.isNaN(summaryId) || Number.isNaN(deckId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
      }
      userIdForDeck = claims.userId;
    } else {
      const user = await getRequestUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userIdForDeck = user.id;
    }

    const deck = await prisma.slideDeck.findFirst({
      where: { id: deckId, summaryId, userId: userIdForDeck },
      select: { title: true, pptxUrl: true },
    });
    if (!deck) {
      return NextResponse.json({ error: "Slide deck not found" }, { status: 404 });
    }

    const result = await get(deck.pptxUrl, { access: "private", useCache: true });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
    }

    const fn = safeAsciiFilename(deck.title || "presentation");
    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `inline; filename="${fn}.pptx"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("slide deck view:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}

