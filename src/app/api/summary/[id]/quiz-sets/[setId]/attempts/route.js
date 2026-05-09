import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

const MAX_ANSWERS_JSON_BYTES = 50_000;
const DUPLICATE_ATTEMPT_WINDOW_MS = 12_000;

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

async function loadOwnedQuizSet(summaryId, setId, userId) {
  return prisma.quizSet.findFirst({
    where: { id: setId, summaryId, userId },
    select: { id: true },
  });
}

/** GET — list attempts for this quiz (newest first, capped) */
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

    const quiz = await loadOwnedQuizSet(summaryId, setId, user.id);
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const [attempts, questions] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { quizSetId: setId, userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          score: true,
          totalQuestions: true,
          answers: true,
          createdAt: true,
        },
      }),
      prisma.quizQuestion.findMany({
        where: { quizSetId: setId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          question: true,
          answer: true,
        },
      }),
    ]);
    return NextResponse.json({ attempts, questions });
  } catch (err) {
    console.error("quiz-sets attempts GET:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}

/** POST — record a finished attempt */
export async function POST(req, context) {
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

    const quiz = await loadOwnedQuizSet(summaryId, setId, user.id);
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const totalQuestions = Number(body?.totalQuestions);
    const score = Number(body?.score);
    let answers = body?.answers;

    if (!Number.isFinite(totalQuestions) || totalQuestions < 1 || totalQuestions > 500) {
      return NextResponse.json({ error: "Invalid totalQuestions" }, { status: 400 });
    }
    if (!Number.isFinite(score) || score < 0 || score > totalQuestions) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    if (answers != null && typeof answers === "object") {
      const serialized = JSON.stringify(answers);
      if (serialized.length > MAX_ANSWERS_JSON_BYTES) {
        return NextResponse.json({ error: "answers payload too large" }, { status: 413 });
      }
    } else if (answers != null && answers !== undefined) {
      return NextResponse.json({ error: "answers must be an object" }, { status: 400 });
    } else {
      answers = undefined;
    }

    // Best-effort idempotency: drop accidental duplicate writes from repeated
    // frontend effects / retries when payload is identical within a short window.
    const latestAttempt = await prisma.quizAttempt.findFirst({
      where: { quizSetId: setId, userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        score: true,
        totalQuestions: true,
        answers: true,
        createdAt: true,
      },
    });
    if (latestAttempt) {
      const incomingAnswers = answers ?? null;
      const existingAnswers = latestAttempt.answers ?? null;
      const samePayload =
        latestAttempt.score === score &&
        latestAttempt.totalQuestions === totalQuestions &&
        JSON.stringify(existingAnswers) === JSON.stringify(incomingAnswers);
      const createdAtMs = new Date(latestAttempt.createdAt).getTime();
      const closeInTime =
        Number.isFinite(createdAtMs) &&
        Date.now() - createdAtMs <= DUPLICATE_ATTEMPT_WINDOW_MS;
      if (samePayload && closeInTime) {
        return NextResponse.json({
          attempt: {
            id: latestAttempt.id,
            score: latestAttempt.score,
            totalQuestions: latestAttempt.totalQuestions,
            createdAt: latestAttempt.createdAt,
          },
          deduped: true,
        });
      }
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        quizSetId: setId,
        score,
        totalQuestions,
        ...(answers != null ? { answers } : {}),
      },
      select: {
        id: true,
        score: true,
        totalQuestions: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ attempt });
  } catch (err) {
    console.error("quiz-sets attempts POST:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
