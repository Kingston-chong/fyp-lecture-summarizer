import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

async function getUserFromSession() {
  return getRequestUser();
}

async function getIdsFromParams(params) {
  const resolved = await params;
  const summaryId = Number(resolved?.id);
  const highlightId = Number(resolved?.highlightId);
  if (!Number.isFinite(summaryId) || !Number.isFinite(highlightId)) {
    throw new Error("Invalid id");
  }
  return { summaryId, highlightId };
}

export async function DELETE(_req, ctx) {
  try {
    const user = await getUserFromSession();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { summaryId, highlightId } = await getIdsFromParams(ctx.params);

    const deleted = await prisma.summaryHighlight.deleteMany({
      where: {
        id: highlightId,
        summaryId,
        userId: user.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err?.message || "";
    if (msg === "Invalid id") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Failed to delete highlight" },
      { status: 500 },
    );
  }
}
