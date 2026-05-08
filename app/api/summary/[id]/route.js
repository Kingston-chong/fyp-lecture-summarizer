import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

async function getUserFromSession() {
  return getRequestUser();
}

async function getIdFromParams(params) {
  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) {
    throw new Error("Invalid id");
  }
  return id;
}

export async function GET(_req, ctx) {
  try {
    const user = await getUserFromSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = await getIdFromParams(ctx.params);

    const summary = await prisma.summary.findFirst({
      where: { id, userId: user.id },
      include: {
        documents: { include: { document: true } },
      },
    });

    if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const formatted = {
      id: summary.id,
      title: summary.title,
      model: summary.model,
      summarizeFor: summary.summarizeFor,
      output: summary.output,
      createdAt: summary.createdAt,
      files: summary.documents.map((d) => ({
        id: d.document.id,
        name: d.document.name,
        type: d.document.type,
      })),
    };

    return NextResponse.json({ summary: formatted });
  } catch (err) {
    const msg = err?.message || "Failed to fetch summary";
    if (msg === "Invalid id") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }
}

export async function PATCH(req, ctx) {
  try {
    const user = await getUserFromSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = await getIdFromParams(ctx.params);
    const body = await req.json();
    const title = (body?.title || "").toString().trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const updated = await prisma.summary.updateMany({
      where: { id, userId: user.id },
      data: { title },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update summary" }, { status: 500 });
  }
}

export async function DELETE(_req, ctx) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = await getIdFromParams(ctx.params);

    // Ensure link-table rows are removed first (prevents FK constraint failures)
    await prisma.summaryDocument.deleteMany({
      where: { summaryId: id },
    });

    const deleted = await prisma.summary.deleteMany({
      where: { id, userId: user.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete summary" }, { status: 500 });
  }
}
