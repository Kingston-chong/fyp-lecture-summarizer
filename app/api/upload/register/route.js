import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import {
  assertPathnameForUser,
  extensionFromName,
  ALLOWED_EXTENSIONS,
} from "@/lib/documentUpload";

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || "").trim();
    const pathname = String(body?.pathname || "").trim();
    const name = String(body?.name || "").trim();
    const size = Number(body?.size);
    const sourceUrlRaw = body?.sourceUrl;
    const sourceUrl =
      sourceUrlRaw != null && String(sourceUrlRaw).trim()
        ? String(sourceUrlRaw).trim().slice(0, 2048)
        : null;

    if (!url || !name) {
      return NextResponse.json(
        { error: "Missing url or name" },
        { status: 400 },
      );
    }
    if (pathname) {
      try {
        assertPathnameForUser(pathname, user.id);
      } catch {
        return NextResponse.json(
          { error: "Invalid pathname" },
          { status: 400 },
        );
      }
    }

    const type = String(body?.type || extensionFromName(name));
    if (!ALLOWED_EXTENSIONS.has(type)) {
      return NextResponse.json(
        { error: `Unsupported file type: .${type.toLowerCase()}` },
        { status: 415 },
      );
    }

    const existing = await prisma.document.findFirst({
      where: { userId: user.id, url },
    });
    if (existing) {
      return NextResponse.json({ success: true, document: existing });
    }

    const doc = await prisma.document.create({
      data: {
        userId: user.id,
        name,
        url,
        type,
        size: Number.isFinite(size) && size > 0 ? size : 0,
        ...(sourceUrl ? { sourceUrl } : {}),
      },
    });

    return NextResponse.json({ success: true, document: doc });
  } catch (err) {
    console.error("upload/register:", err);
    return NextResponse.json(
      { error: err?.message || "Register failed" },
      { status: 500 },
    );
  }
}
