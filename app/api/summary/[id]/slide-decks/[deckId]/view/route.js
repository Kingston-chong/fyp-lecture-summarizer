import { NextResponse } from "next/server";
import {
  fetchSlideDeckStream,
  resolveSlideDeckAccess,
  safeAsciiFilename,
} from "@/lib/slideDeckAccess";

/**
 * Stream a stored slide deck for inline viewing (Office embed/new tab).
 * Auth: session cookie, OR `?t=` HMAC token (for Microsoft Office Online viewer fetch).
 */
export async function GET(req, context) {
  try {
    const params = await Promise.resolve(context.params);
    const summaryId = parseInt(String(params?.id ?? ""), 10);
    const deckId = parseInt(String(params?.deckId ?? ""), 10);
    if (Number.isNaN(summaryId) || Number.isNaN(deckId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const access = await resolveSlideDeckAccess(req, { summaryId, deckId });
    if (access.error) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const { deck, blobRef } = access;
    const result = await fetchSlideDeckStream(blobRef);
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: 502 },
      );
    }

    const fn = safeAsciiFilename(deck.title || "presentation");
    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `inline; filename="${fn}.pptx"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("slide deck view:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
