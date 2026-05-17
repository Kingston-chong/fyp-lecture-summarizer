import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureQuizNotExpired,
  isQuizAcceptingResponses,
} from "@/lib/quizCollection";

function publicQuestion(q) {
  return {
    id: q.id,
    question: q.question,
    type: q.type,
    options: q.options,
    order: q.order,
  };
}

export async function GET(_req, context) {
  try {
    const resolved = await Promise.resolve(context?.params);
    const token = String(resolved?.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const quizSet = await prisma.quizSet.findFirst({
      where: { shareToken: token, published: true },
      include: {
        questions: { orderBy: { order: "asc" } },
      },
    });

    if (!quizSet) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const active = await ensureQuizNotExpired(prisma, quizSet);
    const accepting = isQuizAcceptingResponses(active);

    return NextResponse.json({
      acceptingResponses: accepting,
      collectionStatus: accepting ? "open" : "closed",
      closesAt: active.closesAt,
      quizSet: {
        id: active.id,
        title: active.title,
        settings: active.settings,
        questions: active.questions.map(publicQuestion),
      },
    });
  } catch (err) {
    console.error("quiz share GET:", err);
    return NextResponse.json({ error: "Failed to load quiz" }, { status: 500 });
  }
}
