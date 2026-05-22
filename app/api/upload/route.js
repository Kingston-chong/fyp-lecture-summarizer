// app/api/upload/route.js — small files only; large files use client Blob upload (lib/clientDocumentUpload.js).
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import {
  MAX_FILE_BYTES,
  SERVERLESS_UPLOAD_MAX_BYTES,
  resolveUploadName,
  buildBlobPathname,
} from "@/lib/documentUpload";

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files");
    // "rename" field is a JSON array of booleans — true means rename this file
    const renameFlags = JSON.parse(formData.get("renameFlags") || "[]");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Fetch all existing document names for this user (for duplicate checking)
    const existingDocs = await prisma.document.findMany({
      where: { userId: user.id },
      select: { name: true },
    });
    const existingNames = new Set(existingDocs.map((d) => d.name));

    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const shouldRename = renameFlags[i] === true;

      if (!file || typeof file === "string") {
        return NextResponse.json(
          { error: "Invalid file upload payload" },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_BYTES) {
        const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
        return NextResponse.json(
          { error: `File too large (max ${maxMb} MB): ${file.name}` },
          { status: 413 },
        );
      }

      if (file.size > SERVERLESS_UPLOAD_MAX_BYTES) {
        const limitMb = Math.round(SERVERLESS_UPLOAD_MAX_BYTES / (1024 * 1024));
        return NextResponse.json(
          {
            error:
              `File "${file.name}" is too large for direct server upload (${limitMb} MB limit). ` +
              "The app will upload it via the browser automatically — refresh the page and try again.",
            code: "USE_CLIENT_UPLOAD",
          },
          { status: 413 },
        );
      }

      let finalName;
      let ext;
      try {
        ({ finalName, type: ext } = resolveUploadName(
          file.name,
          existingNames,
          shouldRename,
        ));
      } catch (typeErr) {
        return NextResponse.json(
          { error: typeErr?.message || "Unsupported file type" },
          { status: 415 },
        );
      }

      const blob = await put(buildBlobPathname(user.id, finalName), file, {
        access: "private",
      });

      // Save to database with the (possibly renamed) name
      const doc = await prisma.document.create({
        data: {
          userId: user.id,
          name: finalName,
          url: blob.url,
          type: ext,
          size: file.size,
        },
      });

      uploaded.push({ ...doc, originalName: file.name, finalName });
    }

    return NextResponse.json({ success: true, documents: uploaded });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed: " + err.message },
      { status: 500 },
    );
  }
}
