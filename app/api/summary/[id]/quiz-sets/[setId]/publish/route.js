import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

async function resolveIds(context) {
  const resolved = await Promise.resolve(context?.params);
  const summaryId = parseInt(resolved?.id ?? "", 10);
  const setId = parseInt(resolved?.setId ?? "", 10);
  return {
    summaryId: Number.isFinite(summaryId) && summaryId > 0 ? summaryId : null,
    setId: Number.isFinite(setId) && setId > 0 ? setId : null,
  };
}

export async function POST(req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { summaryId, setId } = await resolveIds(context);
    if (!summaryId || !setId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const wantPublished = Boolean(body.published);

    const quizSet = await prisma.quizSet.findFirst({
      where: { id: setId, summaryId, userId: user.id },
      select: { id: true, shareToken: true, published: true },
    });
    if (!quizSet) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    let shareToken = quizSet.shareToken;
    if (wantPublished && !shareToken) {
      shareToken = randomBytes(24).toString("hex");
    }

    const updated = await prisma.quizSet.update({
      where: { id: setId },
      data: {
        published: wantPublished,
        shareToken: wantPublished ? shareToken : quizSet.shareToken,
      },
      select: { published: true, shareToken: true },
    });

    return NextResponse.json({
      published: updated.published,
      shareToken: updated.published ? updated.shareToken : null,
    });
  } catch (err) {
    console.error("quiz publish:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
