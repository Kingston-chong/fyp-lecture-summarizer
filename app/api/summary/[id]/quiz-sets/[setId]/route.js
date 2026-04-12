import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

async function resolveIds(context) {
  const resolved = await Promise.resolve(context?.params);
  const summaryRaw = resolved?.id;
  const setRaw = resolved?.setId;
  const summaryId = Number.parseInt(String(summaryRaw), 10);
  const setId = Number.parseInt(String(setRaw), 10);
  if (!Number.isFinite(summaryId) || summaryId <= 0) return { summaryId: null, setId: null };
  if (!Number.isFinite(setId) || setId <= 0) return { summaryId, setId: null };
  return { summaryId, setId };
}

/** GET — one quiz set with questions (for sidebar open / retake) */
export async function GET(_req, context) {
  try {
    const { summaryId, setId } = await resolveIds(context);
    if (!summaryId) {
      return NextResponse.json({ error: "Invalid summary id" }, { status: 400 });
    }
    if (!setId) {
      return NextResponse.json({ error: "Invalid quiz set id" }, { status: 400 });
    }

    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true },
    });
    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    const quizSet = await prisma.quizSet.findFirst({
      where: { id: setId, summaryId, userId: user.id },
      include: {
        questions: { orderBy: { order: "asc" } },
      },
    });

    if (!quizSet) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({ quizSet });
  } catch (err) {
    console.error("quiz-sets/[setId] GET:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
