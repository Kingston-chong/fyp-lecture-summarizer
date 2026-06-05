/** Upload size limits shared by client and server. */

const MB = 1024 * 1024;

/** Vercel serverless request body limit (~4.5 MB). Files in POST bodies must stay below this. */
export const SERVERLESS_PAYLOAD_MAX_BYTES = Number.parseInt(
  process.env.SERVERLESS_UPLOAD_MAX_BYTES || String(4 * MB),
  10,
);

/** Direct-to-Blob uploads (signed-in documents & chat file attachments). */
export const MAX_UPLOAD_FILE_BYTES = Number.parseInt(
  process.env.UPLOAD_MAX_FILE_BYTES || String(25 * MB),
  10,
);

/**
 * One pasted chat image (base64 in JSON). Kept well under the serverless cap
 * so a message with several images still fits in one POST.
 */
export const MAX_CHAT_IMAGE_BYTES = Number.parseInt(
  process.env.CHAT_MAX_IMAGE_BYTES || String(900_000),
  10,
);

/** Combined size of all pasted images attached to a single chat send. */
export const MAX_CHAT_PASTE_IMAGES_TOTAL_BYTES = Number.parseInt(
  process.env.CHAT_MAX_PASTE_TOTAL_BYTES ||
    String(Math.max(512_000, SERVERLESS_PAYLOAD_MAX_BYTES - 512_000)),
  10,
);

/** @param {number} bytes */
export function formatUploadLimitLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= MB) {
    const mb = bytes / MB;
    return mb >= 10
      ? `${Math.round(mb)} MB`
      : `${mb.toFixed(1).replace(/\.0$/, "")} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

/** @param {string} dataUrl */
export function dataUrlByteLength(dataUrl) {
  const idx = String(dataUrl).indexOf("base64,");
  if (idx === -1) return 0;
  const b64 = String(dataUrl).slice(idx + 7);
  return Math.floor((b64.length * 3) / 4);
}

/** @param {File | null | undefined} */
export function validateChatDocumentFile(file) {
  if (!file?.name || !(file.size > 0)) {
    return { ok: false, error: "Invalid file." };
  }
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    return {
      ok: false,
      error: `"${file.name}" is too large (max ${formatUploadLimitLabel(MAX_UPLOAD_FILE_BYTES)} per file).`,
    };
  }
  return { ok: true };
}

/**
 * @param {string} dataUrl
 * @param {{ currentTotalBytes?: number }} [options]
 */
export function validateChatImageDataUrl(
  dataUrl,
  { currentTotalBytes = 0 } = {},
) {
  const bytes = dataUrlByteLength(dataUrl);
  if (bytes <= 0) {
    return { ok: false, error: "Could not read image data." };
  }
  if (bytes > MAX_CHAT_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image is too large after compression (max ${formatUploadLimitLabel(MAX_CHAT_IMAGE_BYTES)} each). Try a smaller image.`,
    };
  }
  const nextTotal = currentTotalBytes + bytes;
  if (nextTotal > MAX_CHAT_PASTE_IMAGES_TOTAL_BYTES) {
    return {
      ok: false,
      error: `Total pasted images for one message cannot exceed ${formatUploadLimitLabel(MAX_CHAT_PASTE_IMAGES_TOTAL_BYTES)} (server request limit). Remove an image or use smaller files.`,
    };
  }
  return { ok: true, bytes };
}
