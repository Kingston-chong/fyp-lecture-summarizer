import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { formatReferencesForClient } from "@/lib/referenceUtils";

async function getSummaryId(params) {
  const resolved = await Promise.resolve(params);
  const id = parseInt(resolved?.id ?? "", 10);
  if (Number.isNaN(id)) return null;
  return id;
}

export async function GET(_req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summaryId = await getSummaryId(context.params);
    if (summaryId == null) {
      return NextResponse.json(
        { error: "Invalid summary id" },
        { status: 400 },
      );
    }

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true, summarizeFor: true },
    });
    if (!summary) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const references = await prisma.summaryReference.findMany({
      where: { summaryId, kind: { not: "upload" } },
      orderBy: { marker: "asc" },
    });

    return NextResponse.json({
      references: formatReferencesForClient(references),
    });
  } catch (err) {
    console.error("References fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch references" },
      { status: 500 },
    );
  }
}
