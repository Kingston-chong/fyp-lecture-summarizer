import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePublicChatSnapshot } from "@/lib/chatShareSnapshot";

/** Public read-only chat share (no authentication). */
export async function GET(_req, context) {
  try {
    const resolved = await Promise.resolve(context?.params);
    const token = String(resolved?.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const share = await prisma.chatShare.findFirst({
      where: { shareToken: token, published: true },
      select: { snapshot: true, updatedAt: true },
    });

    if (!share) {
      return NextResponse.json(
        { error: "This shared chat is not available." },
        { status: 404 },
      );
    }

    const snapshot = parsePublicChatSnapshot(share.snapshot);
    if (!snapshot) {
      return NextResponse.json(
        { error: "This shared chat is not available." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      snapshot,
      updatedAt: share.updatedAt,
    });
  } catch (err) {
    console.error("public chat share GET:", err);
    return NextResponse.json(
      { error: "Failed to load shared chat" },
      { status: 500 },
    );
  }
}
