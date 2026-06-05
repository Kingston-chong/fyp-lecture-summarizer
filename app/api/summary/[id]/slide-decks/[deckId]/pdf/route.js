import { NextResponse } from "next/server";
import { get, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import {
  downloadPdfBuffer,
  extractPdfUrlFromAlaiGenerationJson,
  getAlaiPdfUrl,
} from "@/lib/alaiSlidePptx";
import { alaiFetch, getAlaiApiKeys, ALAI_BASE } from "@/lib/alaiClient";
import {
  convertPptxBufferToPdf,
  readableStreamToBuffer,
} from "@/lib/pptxToPdf";
import { toBlobRef } from "@/lib/blobRef";

function safeAsciiFilename(name) {
  return String(name || "presentation")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "");
}

function safeSlug(title) {
  return (
    String(title || "presentation")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "slides"
  );
}

async function loadPptxBuffer(pptxRef) {
  const result = await get(pptxRef, { access: "private", useCache: true });
  if (result?.statusCode !== 200 || !result.stream) return null;
  return readableStreamToBuffer(result.stream);
}

async function cachePdfOnDeck({ deckId, userId, summaryId, title, pdfBuffer }) {
  const slug = safeSlug(title);
  const pdfPath = `slides/${userId}/${summaryId}/${Date.now()}-${slug}.pdf`;
  const pdfBlob = await put(pdfPath, pdfBuffer, {
    access: "private",
    contentType: "application/pdf",
  });
  const storedPdfUrl = pdfBlob.pathname || pdfBlob.url;
  await prisma.slideDeck.update({
    where: { id: deckId },
    data: { pdfUrl: storedPdfUrl },
  });
  return storedPdfUrl;
}

export async function GET(_req, context) {
  try {
    const params = await Promise.resolve(context?.params);
    const summaryId = parseInt(String(params?.id ?? ""), 10);
    const deckId = parseInt(String(params?.deckId ?? ""), 10);
    if (Number.isNaN(summaryId) || Number.isNaN(deckId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deck = await prisma.slideDeck.findFirst({
      where: { id: deckId, summaryId, userId: user.id },
      select: {
        title: true,
        pdfUrl: true,
        pptxUrl: true,
        alaiGenerationId: true,
        provider: true,
      },
    });
    if (!deck) {
      return NextResponse.json(
        { error: "Slide deck not found" },
        { status: 404 },
      );
    }

    const fn = safeAsciiFilename(deck.title || "presentation");

    const pdfRef = toBlobRef(deck.pdfUrl);
    if (pdfRef) {
      const result = await get(pdfRef, {
        access: "private",
        useCache: true,
      });
      if (result?.statusCode === 200 && result.stream) {
        return new NextResponse(result.stream, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fn}.pdf"`,
            "Cache-Control": "private, max-age=300",
          },
        });
      }
    }

    let pdfBuffer = null;

    const genId = String(deck.alaiGenerationId || "").trim();
    if (
      genId &&
      String(deck.provider || "alai").toLowerCase() === "alai" &&
      getAlaiApiKeys().length
    ) {
      const urlResult = await getAlaiPdfUrl(genId);
      if (urlResult.ok) {
        const dl = await downloadPdfBuffer(urlResult.pdfUrl);
        if (dl.ok) pdfBuffer = dl.buffer;
      } else {
        const { res: genRes, data: genData } = await alaiFetch(
          `${ALAI_BASE}/generations/${encodeURIComponent(genId)}`,
          { method: "GET" },
        );
        if (genRes.ok) {
          const pdfUrl = extractPdfUrlFromAlaiGenerationJson(genData);
          if (pdfUrl) {
            const dl = await downloadPdfBuffer(pdfUrl);
            if (dl.ok) pdfBuffer = dl.buffer;
          }
        }
      }
    }

    if (!pdfBuffer?.length) {
      const pptxRef = toBlobRef(deck.pptxUrl);
      if (!pptxRef) {
        return NextResponse.json(
          {
            error:
              "PDF is not available. The PPTX file is missing — regenerate slides.",
          },
          { status: 404 },
        );
      }
      const pptxBuffer = await loadPptxBuffer(pptxRef);
      if (!pptxBuffer?.length) {
        return NextResponse.json(
          { error: "Could not read the saved presentation file." },
          { status: 502 },
        );
      }
      const converted = await convertPptxBufferToPdf(pptxBuffer);
      if (!converted.ok) {
        return NextResponse.json({ error: converted.error }, { status: 502 });
      }
      pdfBuffer = converted.buffer;
    }

    if (!pdfBuffer?.length) {
      return NextResponse.json(
        { error: "PDF could not be created for this deck." },
        { status: 502 },
      );
    }

    try {
      await cachePdfOnDeck({
        deckId: deck.id,
        userId: user.id,
        summaryId,
        title: deck.title,
        pdfBuffer,
      });
    } catch (e) {
      console.warn("slide deck pdf cache:", e?.message || e);
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fn}.pdf"`,
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch (err) {
    console.error("slide deck pdf:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
