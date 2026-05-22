/** Shared document upload constants and DB helpers (server-only). */

export const MAX_FILE_BYTES = Number.parseInt(
  process.env.UPLOAD_MAX_FILE_BYTES || String(25 * 1024 * 1024),
  10,
);

/** Vercel serverless request body limit (~4.5 MB). Use client Blob upload above this. */
export const SERVERLESS_UPLOAD_MAX_BYTES = Number.parseInt(
  process.env.SERVERLESS_UPLOAD_MAX_BYTES || String(4 * 1024 * 1024),
  10,
);

export const ALLOWED_EXTENSIONS = new Set([
  "PDF",
  "PPTX",
  "PPT",
  "DOCX",
  "DOC",
  "TXT",
  "XLSX",
  "XLS",
  "CSV",
  "MD",
]);

export function extensionFromName(name) {
  return String(name || "")
    .split(".")
    .pop()
    .toUpperCase();
}

export function generateRenamedFile(originalName, existingNames) {
  const dotIndex = originalName.lastIndexOf(".");
  const hasExt = dotIndex !== -1;
  const base = hasExt ? originalName.slice(0, dotIndex) : originalName;
  const ext = hasExt ? originalName.slice(dotIndex) : "";

  let counter = 1;
  let newName = `${base} (${counter})${ext}`;
  while (existingNames.has(newName)) {
    counter++;
    newName = `${base} (${counter})${ext}`;
  }
  return newName;
}

export function resolveUploadName(originalName, existingNames, shouldRename) {
  const ext = extensionFromName(originalName);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file type: .${String(ext || "").toLowerCase()}. ` +
        "Supported: pdf, pptx, ppt, docx, doc, txt, xlsx, xls, csv, md.",
    );
  }
  let finalName = originalName;
  if (shouldRename && existingNames.has(originalName)) {
    finalName = generateRenamedFile(originalName, existingNames);
  }
  existingNames.add(finalName);
  return { finalName, type: ext };
}

export function buildBlobPathname(userId, finalName) {
  return `uploads/${userId}/${Date.now()}-${finalName}`;
}

export function assertPathnameForUser(pathname, userId) {
  const prefix = `uploads/${userId}/`;
  if (!String(pathname || "").startsWith(prefix)) {
    throw new Error("Invalid upload path");
  }
}
