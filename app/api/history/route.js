// ============================================================
// Returns paginated summaries for the logged-in user (list view)
// ============================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const EXCERPT_CHARS = 200;

export async function GET(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(
      0,
      Number.parseInt(searchParams.get("page") || "0", 10) || 0,
    );
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("limit") || String(DEFAULT_LIMIT),
          10,
        ) || DEFAULT_LIMIT,
      ),
    );
    const skip = page * limit;

    const [summaries, total] = await Promise.all([
      prisma.summary.findMany({
        where: { userId: user.id },
        orderBy: [
          { pinned: "desc" },
          { pinnedAt: "desc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          model: true,
          summarizeFor: true,
          output: true,
          pinned: true,
          pinnedAt: true,
          createdAt: true,
          documents: {
            select: {
              document: {
                select: { id: true, name: true, type: true },
              },
            },
          },
          slideDecks: {
            select: { id: true, title: true, provider: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          },
          quizSets: {
            select: { id: true, title: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.summary.count({ where: { userId: user.id } }),
    ]);

    const formatted = summaries.map((s) => ({
      id: s.id,
      title: s.title,
      model: s.model,
      summarizeFor: s.summarizeFor,
      excerpt: s.output ? String(s.output).slice(0, EXCERPT_CHARS) : "",
      pinned: Boolean(s.pinned),
      pinnedAt: s.pinnedAt,
      createdAt: s.createdAt,
      files: s.documents.map((d) => ({
        id: d.document.id,
        name: d.document.name,
        type: d.document.type,
      })),
      slideDecks: s.slideDecks.map((d) => ({
        id: d.id,
        title: d.title,
        provider: d.provider,
        createdAt: d.createdAt,
      })),
      quizzes: s.quizSets.map((q) => ({
        id: q.id,
        title: q.title,
        createdAt: q.createdAt,
      })),
    }));

    const hasMore = skip + summaries.length < total;

    return NextResponse.json({
      summaries: formatted,
      page,
      limit,
      total,
      hasMore,
    });
  } catch (err) {
    console.error("History error:", err);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}
