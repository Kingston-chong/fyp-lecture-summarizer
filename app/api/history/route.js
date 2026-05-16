// ======================================================= =====
// FILE 1: app/api/history/route.js
// Returns all summaries for the logged-in user
// ============================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

export async function GET(req) {
  try {
    const user = await getRequestUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const summaries = await prisma.summary.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        model: true,
        summarizeFor: true,
        output: true,
        createdAt: true,
        documents: {
          select: {
            document: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
    });

    // Format for frontend
    const formatted = summaries.map((s) => ({
      id: s.id,
      title: s.title,
      model: s.model,
      summarizeFor: s.summarizeFor,
      output: s.output,
      createdAt: s.createdAt,
      files: s.documents.map((d) => ({
        id: d.document.id,
        name: d.document.name,
        type: d.document.type,
      })),
    }));

    return NextResponse.json({ summaries: formatted });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}
