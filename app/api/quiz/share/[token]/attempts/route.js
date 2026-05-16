import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

export async function POST(req, context) {
  try {
    const resolved = await Promise.resolve(context?.params);
    const token = String(resolved?.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const quizSet = await prisma.quizSet.findFirst({
      where: { shareToken: token, published: true },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!quizSet) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const answers =
      body.answers && typeof body.answers === "object" ? body.answers : {};
    const totalQuestions = quizSet.questions.length;
    if (totalQuestions === 0) {
      return NextResponse.json({ error: "Quiz has no questions" }, { status: 400 });
    }

    let score = 0;
    quizSet.questions.forEach((q, idx) => {
      const userAnswer = answers[String(idx)] ?? null;
      if (
        userAnswer != null &&
        String(userAnswer).trim() === String(q.answer ?? "").trim()
      ) {
        score += 1;
      }
    });

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        quizSetId: quizSet.id,
        score,
        totalQuestions,
        answers,
      },
    });

    return NextResponse.json({
      attempt: { id: attempt.id },
      score,
      totalQuestions,
    });
  } catch (err) {
    console.error("quiz share attempt:", err);
    return NextResponse.json(
      { error: "Failed to save attempt" },
      { status: 500 },
    );
  }
}
