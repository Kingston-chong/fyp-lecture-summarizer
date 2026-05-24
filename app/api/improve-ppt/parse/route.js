import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { fetchVercelBlobBuffer } from "@/lib/fetchVercelBlobBuffer";
import { parseBufferToSlidesWithMeta } from "@/lib/improvePptParse";
import { uiModelToKey } from "@/lib/improvePptModel";

export const maxDuration = 120;

function extFlags(name) {
  const n = String(name || "");
  return { isPptx: /\.pptx$/i.test(n), isPdf: /\.pdf$/i.test(n) };
}

function parseOcrFlag(value) {
  if (value === true) return true;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "on";
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
    let enableOcr = false;
    let modelKey = "gemini";
    let modelVariant = null;

    if (ct.includes("application/json")) {
      const json = await req.json();
      const documentId = Number(json?.documentId);
      enableOcr = parseOcrFlag(json?.ocr);
      modelKey = uiModelToKey(json?.model || "Gemini");
      if (json?.modelVariant) {
        modelVariant = String(json.modelVariant).trim() || null;
      }
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
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 },
        );
      }
      name = doc.name || "upload";
      buf = await fetchVercelBlobBuffer(doc.url);
    } else {
      const form = await req.formData();
      const file = form.get("file");
      const docIdRaw = form.get("documentId");
      const documentId = Number(docIdRaw);
      enableOcr = parseOcrFlag(form.get("ocr"));
      modelKey = uiModelToKey(form.get("model") || "Gemini");
      const variantRaw = form.get("modelVariant");
      if (variantRaw) modelVariant = String(variantRaw).trim() || null;

      if (file instanceof Blob && file.size > 0) {
        name = file.name || "upload.pptx";
        buf = Buffer.from(await file.arrayBuffer());
      } else if (Number.isFinite(documentId) && documentId > 0) {
        const doc = await prisma.document.findFirst({
          where: { id: documentId, userId: user.id },
          select: { name: true, url: true },
        });
        if (!doc) {
          return NextResponse.json(
            { error: "Document not found" },
            { status: 404 },
          );
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

    const { slides, ocrApplied, ocrWarning } = await parseBufferToSlidesWithMeta(
      buf,
      isPdf,
      {
        ocr: enableOcr,
        modelKey,
        modelVariant,
      },
    );

    return NextResponse.json({
      slides,
      ...(enableOcr ? { ocrApplied: ocrApplied ?? 0 } : {}),
      ...(ocrWarning ? { ocrWarning } : {}),
    });
  } catch (err) {
    console.error("improve-ppt parse:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
