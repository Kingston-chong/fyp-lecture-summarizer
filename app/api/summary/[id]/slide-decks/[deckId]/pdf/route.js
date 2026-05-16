import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import {
  downloadPdfBuffer,
  getAlaiPdfUrl,
} from "@/lib/alaiSlidePptx";

function safeAsciiFilename(name) {
  return String(name || "presentation")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "");
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
      select: { title: true, pdfUrl: true, alaiGenerationId: true },
    });
    if (!deck) {
      return NextResponse.json(
        { error: "Slide deck not found" },
        { status: 404 },
      );
    }

    const fn = safeAsciiFilename(deck.title || "presentation");

    if (deck.pdfUrl) {
      const result = await get(deck.pdfUrl, {
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

    const genId = String(deck.alaiGenerationId || "").trim();
    if (!genId) {
      return NextResponse.json(
        {
          error:
            "PDF is not available for this deck. Regenerate slides to create a PDF copy.",
        },
        { status: 404 },
      );
    }

    const urlResult = await getAlaiPdfUrl(genId);
    if (!urlResult.ok) {
      return NextResponse.json({ error: urlResult.error }, { status: 404 });
    }

    const dl = await downloadPdfBuffer(urlResult.pdfUrl);
    if (!dl.ok) {
      return NextResponse.json({ error: dl.error }, { status: 502 });
    }

    return new NextResponse(dl.buffer, {
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
