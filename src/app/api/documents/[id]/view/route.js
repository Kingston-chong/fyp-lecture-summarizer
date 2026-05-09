import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { verifyDocumentViewToken } from "@/lib/documentViewToken";

function contentTypeFromFilename(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase() || "";
  const m = {
    pdf: "application/pdf",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
  };
  return m[ext] || "application/octet-stream";
}

function safeAsciiFilename(name) {
  return String(name || "file").replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
}

/**
 * Stream a stored document for inline viewing (iframe/object) or a new tab.
 * Auth: session cookie, OR `?t=` HMAC token (for Microsoft Office Online viewer server-side fetch).
 */
export async function GET(req, context) {
  try {
    const params = await Promise.resolve(context.params);
    const documentId = parseInt(String(params?.id ?? ""), 10);
    if (Number.isNaN(documentId)) {
      return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
    }

    const urlObj = new URL(req.url);
    const rawToken = urlObj.searchParams.get("t");
    let userIdForDoc = null;

    if (rawToken) {
      const claims = verifyDocumentViewToken(rawToken);
      if (!claims || claims.documentId !== documentId) {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
      }
      userIdForDoc = claims.userId;
    } else {
      const user = await getRequestUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userIdForDoc = user.id;
    }

    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId: userIdForDoc },
      select: { name: true, url: true },
    });
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const result = await get(doc.url, { access: "private", useCache: true });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
    }

    const ct = contentTypeFromFilename(doc.name);
    const fn = safeAsciiFilename(doc.name);

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Disposition": `inline; filename="${fn}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("document view:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
