import { NextResponse } from "next/server";
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

/** POST — start or stop accepting student responses for a published quiz */
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
    const wantAccepting = Boolean(body.acceptingResponses);
    let closesAt = null;
    if (body.closesAt != null && String(body.closesAt).trim() !== "") {
      const parsed = new Date(body.closesAt);
      if (!Number.isNaN(parsed.getTime())) closesAt = parsed;
    }

    const quizSet = await prisma.quizSet.findFirst({
      where: { id: setId, summaryId, userId: user.id },
      select: { id: true, published: true, shareToken: true },
    });
    if (!quizSet) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    if (wantAccepting && !quizSet.published) {
      return NextResponse.json(
        { error: "Publish the quiz before starting response collection." },
        { status: 400 },
      );
    }

    const updated = await prisma.quizSet.update({
      where: { id: setId },
      data: {
        acceptingResponses: wantAccepting,
        closesAt: wantAccepting ? closesAt : null,
      },
      select: {
        published: true,
        acceptingResponses: true,
        closesAt: true,
        shareToken: true,
      },
    });

    return NextResponse.json({
      published: updated.published,
      acceptingResponses: updated.acceptingResponses,
      closesAt: updated.closesAt,
      shareToken: updated.published ? updated.shareToken : null,
    });
  } catch (err) {
    console.error("quiz collection:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
