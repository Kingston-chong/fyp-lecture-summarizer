import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_PASTE_IMAGES_TOTAL_BYTES,
  MAX_UPLOAD_FILE_BYTES,
  validateChatDocumentFile,
  validateChatImageDataUrl,
} from "./uploadLimits.js";

test("validateChatDocumentFile rejects oversize files", () => {
  const big = new File(["x"], "big.pdf", {
    type: "application/pdf",
  });
  Object.defineProperty(big, "size", { value: MAX_UPLOAD_FILE_BYTES + 1 });
  const result = validateChatDocumentFile(big);
  assert.equal(result.ok, false);
  assert.match(result.error, /too large/i);
});

test("validateChatImageDataUrl enforces per-image and total caps", () => {
  const small = `data:image/jpeg;base64,${"A".repeat(120)}`;
  assert.equal(validateChatImageDataUrl(small).ok, true);

  const huge = `data:image/jpeg;base64,${"A".repeat(MAX_CHAT_IMAGE_BYTES * 2)}`;
  const tooBig = validateChatImageDataUrl(huge);
  assert.equal(tooBig.ok, false);
  assert.match(tooBig.error, /too large/i);

  const fitsOne = `data:image/jpeg;base64,${"B".repeat(400)}`;
  assert.equal(validateChatImageDataUrl(fitsOne).ok, true);

  const totalExceeded = validateChatImageDataUrl(fitsOne, {
    currentTotalBytes: MAX_CHAT_PASTE_IMAGES_TOTAL_BYTES,
  });
  assert.equal(totalExceeded.ok, false);
  assert.match(totalExceeded.error, /Total pasted images/i);
});
