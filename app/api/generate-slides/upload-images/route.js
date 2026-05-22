import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { ALAI_BASE, alaiErrorPayload, getAlaiApiKey } from "@/lib/alaiClient";
import { logger } from "@/lib/logger";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

/**
 * POST /api/generate-slides/upload-images
 *
 * Accepts multipart/form-data with one or more "files" fields.
 * Validates each file, forwards them to Alai's POST /upload-images,
 * and returns { image_ids: string[] }.
 *
 * Limits (Alai-imposed): max 10 files, 10 MB each.
 * Supported types: PNG, JPEG, WebP, GIF, AVIF, SVG.
 */
export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const alaiKey = getAlaiApiKey();
    if (!alaiKey) {
      return NextResponse.json(
        {
          error:
            "ALAI_API_KEY is not configured. Add a valid key from app.getalai.com to .env.local and restart the dev server.",
          code: "ALAI_NOT_CONFIGURED",
        },
        { status: 500 },
      );
    }

    // Parse the incoming multipart form
    let formData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Could not parse multipart form data." },
        { status: 400 },
      );
    }

    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          error:
            "No files provided. Include at least one file under the 'files' field.",
        },
        { status: 400 },
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. Maximum is ${MAX_FILES} per request.` },
        { status: 400 },
      );
    }

    // Validate each file before forwarding
    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Each 'files' entry must be a file." },
          { status: 400 },
        );
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            error: `Unsupported file type: ${file.type}. Allowed: PNG, JPEG, WebP, GIF, AVIF, SVG.`,
          },
          { status: 415 },
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the 10 MB limit.` },
          { status: 400 },
        );
      }
    }

    // Build a fresh FormData to forward to Alai
    const outForm = new FormData();
    for (const file of files) {
      outForm.append("files", file, file.name);
    }

    const res = await fetch(`${ALAI_BASE}/upload-images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${alaiKey}`,
        // Do NOT set Content-Type — fetch sets it with the correct multipart boundary
      },
      body: outForm,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const { message, httpStatus } = alaiErrorPayload(res, data);
      logger.error(
        "generate-slides/upload-images",
        "Alai POST /upload-images failed",
        { status: res.status, message },
      );
      return NextResponse.json(
        { error: message, code: "ALAI_UPSTREAM", upstreamStatus: res.status },
        { status: httpStatus },
      );
    }

    // Alai returns { image_ids: string[] }
    return NextResponse.json({ image_ids: data.image_ids ?? [] });
  } catch (err) {
    logger.error(
      "generate-slides/upload-images",
      err?.message || "POST failed",
      { stack: err?.stack },
    );
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
