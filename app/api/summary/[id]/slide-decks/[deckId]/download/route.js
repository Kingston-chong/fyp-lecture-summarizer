import { NextResponse } from "next/server";
import {
  fetchSlideDeckStream,
  resolveSlideDeckAccess,
  safeAsciiFilename,
} from "@/lib/slideDeckAccess";

/**
 * Download a stored slide deck (attachment). Private blobs must be streamed
 * through this route — their storage URLs are not browser-accessible.
 */
export async function GET(req, context) {
  try {
    const params = await Promise.resolve(context.params);
    const summaryId = parseInt(String(params?.id ?? ""), 10);
    const deckId = parseInt(String(params?.deckId ?? ""), 10);

    const access = await resolveSlideDeckAccess(req, { summaryId, deckId });
    if (access.error) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const { deck, blobRef } = access;
    const fn = safeAsciiFilename(deck.title || "presentation");

    const ifNoneMatch = req.headers.get("if-none-match") ?? undefined;
    const result = await fetchSlideDeckStream(blobRef, { ifNoneMatch });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: 502 },
      );
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": "private, no-cache",
        },
      });
    }

    if (!result.stream) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: 502 },
      );
    }

    const headers = {
      "Content-Type":
        result.blob.contentType ||
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fn}.pptx"`,
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
    };
    const len = result.blob.size;
    if (len != null) headers["Content-Length"] = String(len);

    return new NextResponse(result.stream, { status: 200, headers });
  } catch (err) {
    console.error("slide deck download:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
