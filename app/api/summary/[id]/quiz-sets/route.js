import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

async function resolveSummaryId(context) {
  const resolved = await Promise.resolve(context?.params);
  const raw = resolved?.id;
  const id = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

/** GET — list saved quiz sets for this summary */
export async function GET(_req, context) {
  try {
    const summaryId = await resolveSummaryId(context);
    if (!summaryId) {
      return NextResponse.json(
        { error: "Invalid summary id" },
        { status: 400 },
      );
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

    const quizSets = await prisma.quizSet.findMany({
      where: { summaryId, userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true } },
        attempts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            score: true,
            totalQuestions: true,
            createdAt: true,
          },
        },
      },
    });

    const payload = quizSets.map((q) => {
      const latest = q.attempts?.[0] ?? null;
      const { attempts, ...rest } = q;
      return {
        ...rest,
        latestAttempt: latest,
      };
    });

    return NextResponse.json({ quizSets: payload });
  } catch (err) {
    console.error("quiz-sets GET:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
