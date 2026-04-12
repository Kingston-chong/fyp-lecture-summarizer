import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { downloadPptxBuffer, getAlaiPptxUrl } from "@/lib/alaiSlidePptx";
import { getRequestUser } from "@/lib/apiAuth";

async function resolveSummaryId(context) {
  const resolved = await Promise.resolve(context?.params);
  const raw = resolved?.id;
  const id = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

/** GET — list saved slide decks for this summary */
export async function GET(req, context) {
  try {
    const summaryId = await resolveSummaryId(context);
    if (!summaryId) {
      return NextResponse.json({ error: "Invalid summary id" }, { status: 400 });
    }

    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true },
    });
    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    const decks = await prisma.slideDeck.findMany({
      where: { summaryId, userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        alaiGenerationId: true,
        pptxUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ decks });
  } catch (err) {
    console.error("slide-decks GET:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}

/** POST — archive a completed Alai generation to Blob + DB */
export async function POST(req, context) {
  try {
    const summaryId = await resolveSummaryId(context);
    if (!summaryId) {
      return NextResponse.json({ error: "Invalid summary id" }, { status: 400 });
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

    const body = await req.json().catch(() => ({}));
    const alaiGenerationId = String(body?.alaiGenerationId || "").trim();
    if (!alaiGenerationId) {
      return NextResponse.json({ error: "alaiGenerationId is required" }, { status: 400 });
    }

    const titleRaw = String(body?.title || "").trim();
    const title =
      titleRaw.slice(0, 512) ||
      (summary.title || "Presentation").slice(0, 512);

    const urlResult = await getAlaiPptxUrl(alaiGenerationId);
    if (!urlResult.ok) {
      return NextResponse.json(
        { error: urlResult.error },
        { status: urlResult.status && urlResult.status !== 200 ? urlResult.status : 502 },
      );
    }

    const dl = await downloadPptxBuffer(urlResult.pptUrl);
    if (!dl.ok) {
      return NextResponse.json({ error: dl.error }, { status: 502 });
    }

    const safeSlug = title
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "slides";
    const pathname = `slides/${user.id}/${summaryId}/${Date.now()}-${safeSlug}.pptx`;

    const blob = await put(pathname, dl.buffer, {
      access: "public",
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    const deck = await prisma.slideDeck.create({
      data: {
        userId: user.id,
        summaryId,
        title,
        alaiGenerationId: alaiGenerationId.slice(0, 128),
        pptxUrl: blob.url,
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
    console.error("slide-decks POST:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
