import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { signSlideDeckViewToken } from "@/lib/slideDeckViewToken";

/** Mint a short-lived token so /view?t=… works without cookies (Office Online viewer fetch). */
export async function GET(_req, context) {
  try {
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await Promise.resolve(context.params);
    const summaryId = parseInt(String(params?.id ?? ""), 10);
    const deckId = parseInt(String(params?.deckId ?? ""), 10);
    if (Number.isNaN(summaryId) || Number.isNaN(deckId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const deck = await prisma.slideDeck.findFirst({
      where: { id: deckId, summaryId, userId: user.id },
      select: { id: true },
    });
    if (!deck) return NextResponse.json({ error: "Slide deck not found" }, { status: 404 });

    let token;
    try {
      token = signSlideDeckViewToken(summaryId, deckId, user.id);
    } catch (e) {
      console.error("slide-deck view-token sign:", e);
      return NextResponse.json(
        { error: "Server missing DOCUMENT_VIEW_TOKEN_SECRET or NEXTAUTH_SECRET" },
        { status: 500 },
      );
    }

    return NextResponse.json({ token });
  } catch (err) {
    console.error("slide-deck view-token:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}

