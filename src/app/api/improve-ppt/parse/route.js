import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { fetchVercelBlobBuffer } from "@/lib/fetchVercelBlobBuffer";
import { parsePptxBufferToSlides, parsePdfBufferToSlides } from "@/lib/improvePptParse";

function extFlags(name) {
  const n = String(name || "");
  return { isPptx: /\.pptx$/i.test(n), isPdf: /\.pdf$/i.test(n) };
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ct = req.headers.get("content-type") || "";
    let buf;
    let name = "";

    if (ct.includes("application/json")) {
      const json = await req.json();
      const documentId = Number(json?.documentId);
      if (!Number.isFinite(documentId) || documentId <= 0) {
        return NextResponse.json(
          { error: "Missing or invalid documentId" },
          { status: 400 },
        );
      }
      const doc = await prisma.document.findFirst({
        where: { id: documentId, userId: user.id },
        select: { name: true, url: true },
      });
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      name = doc.name || "upload";
      buf = await fetchVercelBlobBuffer(doc.url);
    } else {
      const form = await req.formData();
      const file = form.get("file");
      const docIdRaw = form.get("documentId");
      const documentId = Number(docIdRaw);

      if (file instanceof Blob && file.size > 0) {
        name = file.name || "upload.pptx";
        buf = Buffer.from(await file.arrayBuffer());
      } else if (Number.isFinite(documentId) && documentId > 0) {
        const doc = await prisma.document.findFirst({
          where: { id: documentId, userId: user.id },
          select: { name: true, url: true },
        });
        if (!doc) {
          return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }
        name = doc.name || "upload";
        buf = await fetchVercelBlobBuffer(doc.url);
      } else {
        return NextResponse.json(
          { error: "Send a file or documentId" },
          { status: 400 },
        );
      }
    }

    const { isPptx, isPdf } = extFlags(name);
    if (!isPptx && !isPdf) {
      return NextResponse.json(
        {
          error:
            "Only .pptx or .pdf files are supported. For .ppt, convert to .pptx in PowerPoint first.",
        },
        { status: 400 },
      );
    }

    const slides = isPdf
      ? await parsePdfBufferToSlides(buf)
      : await parsePptxBufferToSlides(buf);

    return NextResponse.json({ slides });
  } catch (err) {
    console.error("improve-ppt parse:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
