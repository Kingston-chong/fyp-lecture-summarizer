import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import {
  MAX_FILE_BYTES,
  buildBlobPathname,
  resolveUploadName,
} from "@/lib/documentUpload";

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const size = Number(body?.size);
    const shouldRename = body?.shouldRename === true;

    if (!name) {
      return NextResponse.json({ error: "Missing file name" }, { status: 400 });
    }
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
    }
    if (size > MAX_FILE_BYTES) {
      const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
      return NextResponse.json(
        { error: `File too large (max ${maxMb} MB): ${name}` },
        { status: 413 },
      );
    }

    const existingDocs = await prisma.document.findMany({
      where: { userId: user.id },
      select: { name: true },
    });
    const existingNames = new Set(existingDocs.map((d) => d.name));

    let finalName;
    let type;
    try {
      ({ finalName, type } = resolveUploadName(
        name,
        existingNames,
        shouldRename,
      ));
    } catch (err) {
      return NextResponse.json(
        { error: err?.message || "Unsupported file type" },
        { status: 415 },
      );
    }

    const pathname = buildBlobPathname(user.id, finalName);
    return NextResponse.json({ pathname, finalName, type, size });
  } catch (err) {
    console.error("upload/prepare:", err);
    return NextResponse.json(
      { error: err?.message || "Prepare failed" },
      { status: 500 },
    );
  }
}
