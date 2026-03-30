import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

async function getUserFromSession() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user;
}

async function getIdFromParams(params) {
  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) throw new Error("Invalid id");
  return id;
}

export async function GET(_req, ctx) {
  try {
    const user = await getUserFromSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const summaryId = await getIdFromParams(ctx.params);

    const owned = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // NOTE: use raw SQL to avoid depending on regenerated Prisma client models.
    const threadRows = await prisma.$queryRaw`
      SELECT id
      FROM ChatThread
      WHERE userId = ${user.id} AND summaryId = ${summaryId}
      LIMIT 1
    `;
    const threadId = threadRows?.[0]?.id;

    const messages = threadId
      ? await prisma.$queryRaw`
          SELECT id, role, content, modelLabel
          FROM ChatMessage
          WHERE threadId = ${threadId}
          ORDER BY turn ASC
        `
      : [];

    return NextResponse.json({
      messages,
    });
  } catch (err) {
    const msg = err?.message || "Failed to load chat";
    if (msg === "Invalid id") return NextResponse.json({ error: msg }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

