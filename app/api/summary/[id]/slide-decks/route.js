import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  downloadPdfBuffer,
  downloadPptxBuffer,
  extractPdfUrlFromAlaiGenerationJson,
  getAlaiPptxUrl,
} from "@/lib/alaiSlidePptx";
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
        pdfUrl: true,
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

    const body = await req.json().catch(() => ({}));
    const alaiGenerationId = String(body?.alaiGenerationId || "").trim();
    if (!alaiGenerationId) {
      return NextResponse.json(
        { error: "alaiGenerationId is required" },
        { status: 400 },
      );
    }

    const titleRaw = String(body?.title || "").trim();
    const title =
      titleRaw.slice(0, 512) || (summary.title || "Presentation").slice(0, 512);

    /** Same signed URL the client got when polling — avoids a racey second Alai GET. */
    const remotePptxUrl = String(body?.remotePptxUrl || "").trim();

    let dl = null;
    if (/^https?:\/\//i.test(remotePptxUrl)) {
      dl = await downloadPptxBuffer(remotePptxUrl);
    }
    if (!dl?.ok) {
      const urlResult = await getAlaiPptxUrl(alaiGenerationId);
      if (!urlResult.ok) {
        return NextResponse.json(
          { error: urlResult.error },
          {
            status:
              urlResult.status && urlResult.status !== 200
                ? urlResult.status
                : 502,
          },
        );
      }
      dl = await downloadPptxBuffer(urlResult.pptUrl);
    }
    if (!dl?.ok) {
      return NextResponse.json(
        { error: dl?.error || "Failed to download PPTX" },
        { status: 502 },
      );
    }

    const safeSlug =
      title
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase() || "slides";
    const pathname = `slides/${user.id}/${summaryId}/${Date.now()}-${safeSlug}.pptx`;

    const blob = await put(pathname, dl.buffer, {
      access: "private",
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const storedPptxUrl = blob.downloadUrl || blob.url;

    let storedPdfUrl = null;
    const remotePdfUrl = String(body?.remotePdfUrl || "").trim();
    let pdfDl = null;
    if (/^https?:\/\//i.test(remotePdfUrl)) {
      pdfDl = await downloadPdfBuffer(remotePdfUrl);
    }
    if (!pdfDl?.ok) {
      const genRes = await fetch(
        `https://slides-api.getalai.com/api/v1/generations/${encodeURIComponent(alaiGenerationId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${process.env.ALAI_API_KEY}` },
          cache: "no-store",
        },
      );
      const genData = await genRes.json().catch(() => ({}));
      if (genRes.ok) {
        const pdfFromAlai = extractPdfUrlFromAlaiGenerationJson(genData);
        if (pdfFromAlai) pdfDl = await downloadPdfBuffer(pdfFromAlai);
      }
    }
    if (pdfDl?.ok) {
      const pdfPath = `slides/${user.id}/${summaryId}/${Date.now()}-${safeSlug}.pdf`;
      const pdfBlob = await put(pdfPath, pdfDl.buffer, {
        access: "private",
        contentType: "application/pdf",
      });
      storedPdfUrl = pdfBlob.downloadUrl || pdfBlob.url;
    }

    const deck = await prisma.slideDeck.create({
      data: {
        userId: user.id,
        summaryId,
        title,
        alaiGenerationId: alaiGenerationId.slice(0, 128),
        pptxUrl: storedPptxUrl,
        pdfUrl: storedPdfUrl,
      },
      select: {
        id: true,
        title: true,
        alaiGenerationId: true,
        pptxUrl: true,
        pdfUrl: true,
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

/** DELETE — remove one saved slide deck for this summary */
export async function DELETE(req, context) {
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

    const body = await req.json().catch(() => ({}));
    const deckId = Number.parseInt(String(body?.deckId || ""), 10);
    if (!Number.isFinite(deckId) || deckId <= 0) {
      return NextResponse.json(
        { error: "deckId is required" },
        { status: 400 },
      );
    }

    const deck = await prisma.slideDeck.findFirst({
      where: { id: deckId, summaryId, userId: user.id },
      select: { id: true, pptxUrl: true, pdfUrl: true },
    });
    if (!deck) {
      return NextResponse.json(
        { error: "Slide deck not found" },
        { status: 404 },
      );
    }

    try {
      if (deck.pptxUrl) await del(deck.pptxUrl);
      if (deck.pdfUrl) await del(deck.pdfUrl);
    } catch (e) {
      console.warn("Slide deck blob delete failed:", e?.message || e);
    }

    await prisma.slideDeck.delete({
      where: { id: deck.id },
    });

    return NextResponse.json({ success: true, deckId: deck.id });
  } catch (err) {
    console.error("slide-decks DELETE:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
