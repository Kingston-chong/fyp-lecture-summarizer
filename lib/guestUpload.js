import {
  ALLOWED_EXTENSIONS,
  extensionFromName,
  SERVERLESS_UPLOAD_MAX_BYTES,
} from "./documentUpload.js";
import { formatUploadLimitLabel } from "./uploadLimits.js";

export const GUEST_MAX_FILES = Math.min(
  5,
  Math.max(1, Number.parseInt(process.env.GUEST_MAX_FILES || "3", 10) || 3),
);

/**
 * Client-side guest upload checks (same limits as parseGuestSummarizeFormData).
 * @param {Array<{ name?: string; size?: number }>} files
 */
export function validateGuestFileSelection(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    return { ok: false, error: "Add at least one file to summarize." };
  }
  if (list.length > GUEST_MAX_FILES) {
    return {
      ok: false,
      error: `You can upload up to ${GUEST_MAX_FILES} files at a time.`,
    };
  }
  let totalBytes = 0;
  for (const file of list) {
    const name = file?.name || "document";
    const ext = extensionFromName(name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        ok: false,
        error: `Unsupported file type: .${ext.toLowerCase()}. Supported: pdf, pptx, docx, txt, and more.`,
      };
    }
    totalBytes += file?.size ?? 0;
    if (totalBytes > SERVERLESS_UPLOAD_MAX_BYTES) {
      return {
        ok: false,
        error: `Total upload size exceeds ${formatUploadLimitLabel(SERVERLESS_UPLOAD_MAX_BYTES)}. Sign in to upload larger files.`,
      };
    }
  }
  return { ok: true, totalBytes };
}

/**
 * @param {FormData} formData
 * @returns {{ documents: { name: string, type: string, buffer: Buffer }[], model: string, modelVariant: string | null, summarizeFor: string, prompt: string, publishedYearMode: string, publishedYearFrom: number | null, publishedYearTo: number | null }}
 */
export async function parseGuestSummarizeFormData(formData) {
  const model = String(formData.get("model") || "").trim();
  const modelVariantRaw = formData.get("modelVariant");
  const modelVariant =
    modelVariantRaw != null && String(modelVariantRaw).trim()
      ? String(modelVariantRaw).trim()
      : null;
  const summarizeFor = String(formData.get("summarizeFor") || "student").trim();
  const outputLength = String(formData.get("outputLength") || "medium").trim();
  const prompt = String(formData.get("prompt") || "").trim();
  const publishedYearMode = String(
    formData.get("publishedYearMode") || "all",
  ).trim();
  const publishedYearFrom = parseOptionalInt(formData.get("publishedYearFrom"));
  const publishedYearTo = parseOptionalInt(formData.get("publishedYearTo"));

  if (!model) {
    throw new Error("Model is required");
  }

  const fileEntries = formData.getAll("files").filter(Boolean);
  if (fileEntries.length === 0) {
    throw new Error("At least one file is required");
  }
  if (fileEntries.length > GUEST_MAX_FILES) {
    throw new Error(`You can upload up to ${GUEST_MAX_FILES} files at a time`);
  }

  let totalBytes = 0;
  const documents = [];

  for (const entry of fileEntries) {
    if (typeof entry === "string") continue;
    const file = /** @type {File} */ (entry);
    const name = file.name || "document";
    const ext = extensionFromName(name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(
        `Unsupported file type: .${ext.toLowerCase()}. Supported: pdf, pptx, docx, txt, and more.`,
      );
    }
    const size = file.size ?? 0;
    totalBytes += size;
    if (totalBytes > SERVERLESS_UPLOAD_MAX_BYTES) {
      const mb = Math.round(SERVERLESS_UPLOAD_MAX_BYTES / (1024 * 1024));
      throw new Error(
        `Total upload size exceeds ${mb} MB. Sign in to upload larger files.`,
      );
    }
    documents.push({
      name,
      type: ext,
      buffer: Buffer.from(new Uint8Array(await file.arrayBuffer())),
    });
  }

  if (documents.length === 0) {
    throw new Error("No valid files received");
  }

  return {
    documents,
    model,
    modelVariant,
    summarizeFor,
    outputLength,
    prompt,
    publishedYearMode,
    publishedYearFrom,
    publishedYearTo,
  };
}

function parseOptionalInt(value) {
  if (value == null || value === "") return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}
