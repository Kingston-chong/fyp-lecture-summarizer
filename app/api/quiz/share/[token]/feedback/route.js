import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import {
  ensureQuizNotExpired,
  isQuizAcceptingResponses,
} from "@/lib/quizCollection";

/** POST — reveal correct answer + explanation for one question (shared quiz only). */
export async function POST(req, context) {
  try {
    const resolved = await Promise.resolve(context?.params);
    const token = String(resolved?.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quizSet = await prisma.quizSet.findFirst({
      where: { shareToken: token, published: true },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!quizSet) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const activeQuiz = await ensureQuizNotExpired(prisma, quizSet);
    if (!isQuizAcceptingResponses(activeQuiz)) {
      return NextResponse.json(
        { error: "This quiz is not accepting responses right now." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const questionIndex = Number(body?.questionIndex);
    const userAnswer = body?.userAnswer != null ? String(body.userAnswer) : "";

    if (
      !Number.isFinite(questionIndex) ||
      questionIndex < 0 ||
      questionIndex >= quizSet.questions.length
    ) {
      return NextResponse.json(
        { error: "Invalid question index" },
        { status: 400 },
      );
    }

    const q = quizSet.questions[questionIndex];
    const correctAnswer = String(q.answer ?? "").trim();
    const isCorrect =
      userAnswer.trim() !== "" && userAnswer.trim() === correctAnswer;

    return NextResponse.json({
      questionIndex,
      isCorrect,
      correctAnswer: q.answer ?? "",
      explanation: q.explanation?.trim() || null,
    });
  } catch (err) {
    console.error("quiz share feedback:", err);
    return NextResponse.json(
      { error: "Failed to load feedback" },
      { status: 500 },
    );
  }
}
