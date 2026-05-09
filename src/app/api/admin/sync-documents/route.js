// app/api/admin/sync-documents/route.js
// One-off maintenance endpoint:
// - Scans all prisma.document rows
// - For each, checks if the corresponding Vercel Blob still exists
// - If the blob is missing, deletes the document row and any linked summaryDocument rows
//
// This keeps Prisma Studio "in sync" with what actually exists in Blob storage.

import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

async function blobExists(url) {
  try {
    const result = await get(url, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) {
      return false;
    }
    return true;
  } catch (err) {
    // 404 or other errors we treat as "does not exist" for cleanup purposes
    const msg = String(err?.message || err || "");
    console.warn("Blob existence check failed:", msg);
    return false;
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional: simple admin gate via env var
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && session.user?.email !== adminEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const documents = await prisma.document.findMany();
    const removed = [];
    const kept = [];

    for (const doc of documents) {
      const exists = await blobExists(doc.url);
      if (exists) {
        kept.push(doc.id);
        continue;
      }

      // Blob missing → remove link table rows then the document itself
      await prisma.summaryDocument.deleteMany({
        where: { documentId: doc.id },
      });

      await prisma.document.delete({
        where: { id: doc.id },
      });

      removed.push(doc.id);
    }

    return NextResponse.json({
      success: true,
      removedCount: removed.length,
      keptCount: kept.length,
      removedIds: removed,
    });
  } catch (err) {
    console.error("Sync documents error:", err);
    return NextResponse.json(
      { error: "Failed to sync documents: " + err.message },
      { status: 500 }
    );
  }
}

