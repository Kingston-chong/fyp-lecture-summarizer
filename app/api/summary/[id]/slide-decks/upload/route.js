import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

async function resolveSummaryId(context) {
  const resolved = await Promise.resolve(context?.params);
  const raw = resolved?.id;
  const id = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export async function POST(req, context) {
  try {
    const summaryId = await resolveSummaryId(context);
    if (!summaryId) {
      return NextResponse.json(
        { error: "Invalid summary id" },
        { status: 400 },
      );
    }

    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true, title: true },
    });
    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const titleRaw = String(formData.get("title") || "").trim();

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: 'Multipart field "file" (PPTX) is required.' },
        { status: 400 },
      );
    }

    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (buffer.length < 64) {
      return NextResponse.json(
        { error: "File is too small to be a valid PPTX." },
        { status: 400 },
      );
    }
    if (!buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
      return NextResponse.json(
        { error: "File does not look like a PPTX (ZIP) archive." },
        { status: 400 },
      );
    }

    const title =
      titleRaw.slice(0, 512) || (summary.title || "Presentation").slice(0, 512);

    const safeSlug =
      title
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase() || "slides";
    const pathname = `slides/${user.id}/${summaryId}/${Date.now()}-${safeSlug}.pptx`;

    const blob = await put(pathname, buffer, {
      access: "private",
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const storedPptxUrl = blob.downloadUrl || blob.url;

    const localId =
      `local:${Date.now()}-${Math.random().toString(36).slice(2, 11)}`.slice(
        0,
        128,
      );

    const deck = await prisma.slideDeck.create({
      data: {
        userId: user.id,
        summaryId,
        title,
        alaiGenerationId: localId,
        pptxUrl: storedPptxUrl,
      },
      select: {
        id: true,
        title: true,
        alaiGenerationId: true,
        pptxUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ deck });
  } catch (err) {
    console.error("slide-decks upload POST:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
