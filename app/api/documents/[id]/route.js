// DELETE /api/documents/[id] — remove document from Vercel Blob and DB so it no longer appears in "recently uploaded"
import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

export async function DELETE(req, context) {
  try {
    const user = await getRequestUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await Promise.resolve(context.params);
    const id = params?.id;
    const documentId = parseInt(id ?? "", 10);
    if (Number.isNaN(documentId))
      return NextResponse.json(
        { error: "Invalid document id" },
        { status: 400 },
      );

    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId: user.id },
    });
    if (!doc)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );

    // Remove every upload with this filename (list shows one row per name)
    const toRemove = await prisma.document.findMany({
      where: { userId: user.id, name: doc.name },
      select: { id: true, url: true },
    });

    for (const row of toRemove) {
      try {
        await del(row.url);
      } catch (e) {
        console.warn("Blob delete failed (may already be removed):", e?.message);
      }
      await prisma.summaryDocument.deleteMany({ where: { documentId: row.id } });
      await prisma.document.delete({ where: { id: row.id } });
    }

    return NextResponse.json({ success: true, removed: toRemove.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
