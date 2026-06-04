import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import {
  buildChatShareSnapshot,
  canPublishSummaryShare,
  dbMessageToShareMessage,
  shareSnapshotContentEqual,
} from "@/lib/chatShareSnapshot";

async function getSummaryId(params) {
  const resolved = await Promise.resolve(params);
  const id = Number(resolved?.id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid id");
  return id;
}

async function loadThreadMessages(userId, summaryId) {
  const threadRows = await prisma.$queryRaw`
    SELECT id
    FROM ChatThread
    WHERE userId = ${userId} AND summaryId = ${summaryId}
    LIMIT 1
  `;
  const threadId = threadRows?.[0]?.id;
  if (!threadId) return [];

  const rows = await prisma.$queryRaw`
    SELECT role, content, modelLabel
    FROM ChatMessage
    WHERE threadId = ${threadId}
    ORDER BY turn ASC
  `;

  return (rows || [])
    .map((row) => dbMessageToShareMessage(row))
    .filter(Boolean);
}

export async function GET(_req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summaryId = await getSummaryId(context.params);

    const owned = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const share = await prisma.chatShare.findUnique({
      where: { summaryId },
      select: { published: true, shareToken: true, updatedAt: true },
    });

    return NextResponse.json({
      published: Boolean(share?.published),
      shareToken: share?.published ? share.shareToken : null,
      updatedAt: share?.updatedAt ?? null,
    });
  } catch (err) {
    const msg = err?.message || "Failed to load share status";
    if (msg === "Invalid id") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("chat share GET:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summaryId = await getSummaryId(context.params);
    const body = await req.json().catch(() => ({}));
    const wantPublished = body.published !== false;

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: {
        id: true,
        title: true,
        model: true,
        summarizeFor: true,
        output: true,
        createdAt: true,
      },
    });
    if (!summary) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await prisma.chatShare.findUnique({
      where: { summaryId },
    });

    if (!wantPublished) {
      if (existing) {
        await prisma.chatShare.update({
          where: { summaryId },
          data: { published: false },
        });
      }
      return NextResponse.json({ published: false, shareToken: null });
    }

    const messages = await loadThreadMessages(user.id, summaryId);
    if (!canPublishSummaryShare(summary, messages)) {
      return NextResponse.json(
        {
          error:
            "Nothing to share yet. Wait for the summary to finish generating.",
        },
        { status: 400 },
      );
    }

    const snapshot = buildChatShareSnapshot(summary, messages);

    if (
      existing?.published &&
      existing.shareToken &&
      existing.snapshot &&
      shareSnapshotContentEqual(existing.snapshot, snapshot)
    ) {
      return NextResponse.json({
        published: true,
        shareToken: existing.shareToken,
        updatedAt: existing.updatedAt,
        unchanged: true,
      });
    }

    let shareToken = existing?.shareToken;
    if (!shareToken) {
      shareToken = randomBytes(24).toString("hex");
    }

    const row = await prisma.chatShare.upsert({
      where: { summaryId },
      create: {
        userId: user.id,
        summaryId,
        shareToken,
        published: true,
        snapshot,
      },
      update: {
        shareToken,
        published: true,
        snapshot,
      },
      select: { shareToken: true, published: true, updatedAt: true },
    });

    return NextResponse.json({
      published: row.published,
      shareToken: row.shareToken,
      updatedAt: row.updatedAt,
      unchanged: false,
    });
  } catch (err) {
    const msg = err?.message || "Failed to update share";
    if (msg === "Invalid id") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("chat share POST:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
