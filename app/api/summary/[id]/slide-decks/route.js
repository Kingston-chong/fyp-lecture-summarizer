import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  downloadPdfBuffer,
  downloadPptxBuffer,
  extractPdfUrlFromAlaiGenerationJson,
  getAlaiPptxUrl,
} from "@/lib/alaiSlidePptx";
import { alaiFetch, getAlaiApiKeys, ALAI_BASE } from "@/lib/alaiClient";
import { convertPptxBufferToPdf } from "@/lib/pptxToPdf";
import { getRequestUser } from "@/lib/apiAuth";
import { publicSlideDeckFields, toBlobRef } from "@/lib/blobRef";

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
        provider: true,
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
    const provider = String(body?.provider || "alai").toLowerCase();
    const alaiGenerationId = String(
      body?.alaiGenerationId || body?.providerDeckId || "",
    ).trim();
    const providerDeckId = String(
      body?.providerDeckId || alaiGenerationId || "",
    ).trim();

    if (!alaiGenerationId && !providerDeckId) {
      return NextResponse.json(
        { error: "alaiGenerationId or providerDeckId is required" },
        { status: 400 },
      );
    }

    const titleRaw = String(body?.title || "").trim();
    const title =
      titleRaw.slice(0, 512) || (summary.title || "Presentation").slice(0, 512);

    /** Same signed URL the client got when polling — avoids a racey second Alai GET. */
    const remotePptxUrl = String(body?.remotePptxUrl || "").trim();

    let dl = null;
    if (provider === "2slides") {
      if (!/^https?:\/\//i.test(remotePptxUrl)) {
        return NextResponse.json(
          { error: "remotePptxUrl is required for 2slides decks" },
          { status: 400 },
        );
      }
      dl = await downloadPptxBuffer(remotePptxUrl);
    } else if (/^https?:\/\//i.test(remotePptxUrl)) {
      dl = await downloadPptxBuffer(remotePptxUrl);
    }
    if (!dl?.ok && provider !== "2slides") {
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
    const storedPptxUrl = blob.pathname || blob.url;

    let storedPdfUrl = null;
    const remotePdfUrl = String(body?.remotePdfUrl || "").trim();
    let pdfDl = null;
    if (/^https?:\/\//i.test(remotePdfUrl)) {
      pdfDl = await downloadPdfBuffer(remotePdfUrl);
    }
    if (!pdfDl?.ok && provider === "alai" && getAlaiApiKeys().length) {
      const { res: genRes, data: genData } = await alaiFetch(
        `${ALAI_BASE}/generations/${encodeURIComponent(alaiGenerationId)}`,
        { method: "GET" },
      );
      if (genRes.ok) {
        const pdfFromAlai = extractPdfUrlFromAlaiGenerationJson(genData);
        if (pdfFromAlai) pdfDl = await downloadPdfBuffer(pdfFromAlai);
      }
    }
    if (!pdfDl?.ok && dl.buffer?.length) {
      pdfDl = await convertPptxBufferToPdf(dl.buffer);
    }
    if (pdfDl?.ok) {
      const pdfPath = `slides/${user.id}/${summaryId}/${Date.now()}-${safeSlug}.pdf`;
      const pdfBlob = await put(pdfPath, pdfDl.buffer, {
        access: "private",
        contentType: "application/pdf",
      });
      storedPdfUrl = pdfBlob.pathname || pdfBlob.url;
    }

    const deckIdForDb = (providerDeckId || alaiGenerationId).slice(0, 128);
    const deck = await prisma.slideDeck.create({
      data: {
        userId: user.id,
        summaryId,
        title,
        alaiGenerationId: deckIdForDb,
        provider: provider.slice(0, 32),
        providerDeckId: providerDeckId.slice(0, 256) || deckIdForDb,
        pptxUrl: storedPptxUrl,
        pdfUrl: storedPdfUrl,
      },
      select: {
        id: true,
        title: true,
        alaiGenerationId: true,
        provider: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ deck: publicSlideDeckFields(deck) });
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
      if (deck.pptxUrl) await del(toBlobRef(deck.pptxUrl));
      if (deck.pdfUrl) await del(toBlobRef(deck.pdfUrl));
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
