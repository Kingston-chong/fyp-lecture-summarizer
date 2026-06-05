import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { getClientIp } from "@/lib/rateLimit";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import {
  buildBlobPathname,
  MAX_FILE_BYTES,
  resolveUploadName,
} from "@/lib/documentUpload";
import {
  fetchRemoteDocument,
  GUEST_URL_IMPORT_MAX_BYTES,
} from "@/lib/fetchRemoteDocument";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const user = await getRequestUser();
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || "").trim();

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    if (!user) {
      const ip = getClientIp(req);
      const rateLimited = await applyLlmRateLimit(
        "upload-from-url-guest",
        `ip:${ip}`,
      );
      if (rateLimited) return rateLimited;
    }

    const maxBytes = user ? MAX_FILE_BYTES : GUEST_URL_IMPORT_MAX_BYTES;
    const fetched = await fetchRemoteDocument(url, { maxBytes });

    if (!user) {
      return NextResponse.json({
        name: fetched.name,
        type: fetched.type,
        size: fetched.size,
        data: fetched.buffer.toString("base64"),
      });
    }

    const existingDocs = await prisma.document.findMany({
      where: { userId: user.id },
      select: { name: true },
    });
    const existingNames = new Set(existingDocs.map((d) => d.name));

    const { finalName, type } = resolveUploadName(
      fetched.name,
      existingNames,
      false,
    );

    const blob = await put(
      buildBlobPathname(user.id, finalName),
      fetched.buffer,
      { access: "private" },
    );

    const doc = await prisma.document.create({
      data: {
        userId: user.id,
        name: finalName,
        url: blob.url,
        type,
        size: fetched.size,
      },
    });

    return NextResponse.json({ document: doc });
  } catch (err) {
    console.error("upload/from-url:", err);
    const message = err?.message || "Could not import from link";
    const status =
      message.includes("too large") || message.includes("Too large")
        ? 413
        : message.includes("Unsupported") ||
            message.includes("valid http") ||
            message.includes("Enter a")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
