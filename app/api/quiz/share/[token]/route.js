import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({
      quizSet: {
        id: quizSet.id,
        title: quizSet.title,
        settings: quizSet.settings,
        questions: quizSet.questions.map(publicQuestion),
      },
    });
  } catch (err) {
    console.error("quiz share GET:", err);
    return NextResponse.json(
      { error: "Failed to load quiz" },
      { status: 500 },
    );
  }
}
