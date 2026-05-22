"use client";

import { upload } from "@vercel/blob/client";

/**
 * Upload a file directly to Vercel Blob (browser → Blob), then register the document row.
 * Bypasses the ~4.5 MB Vercel serverless request body limit.
 */
export async function uploadDocumentViaClient(
  file,
  { shouldRename = false } = {},
) {
  if (!file?.name || !(file.size > 0)) {
    throw new Error("Invalid file");
  }

  const prepRes = await fetch("/api/upload/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      shouldRename,
    }),
  });
  const prep = await prepRes.json().catch(() => ({}));
  if (!prepRes.ok) {
    throw new Error(prep.error || "Could not prepare upload");
  }

  const blob = await upload(prep.pathname, file, {
    access: "private",
    handleUploadUrl: "/api/upload/client",
    multipart: file.size > 5 * 1024 * 1024,
    clientPayload: JSON.stringify({ finalName: prep.finalName }),
  });

  const regRes = await fetch("/api/upload/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: blob.url,
      pathname: blob.pathname,
      name: prep.finalName,
      size: file.size,
      type: prep.type,
    }),
  });
  const reg = await regRes.json().catch(() => ({}));
  if (!regRes.ok) {
    throw new Error(reg.error || "Could not save uploaded file");
  }

  return reg.document;
}

/** Upload multiple files sequentially (shows progress via caller). */
export async function uploadDocumentsViaClient(
  files,
  { renameFlags = [] } = {},
) {
  const uploaded = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const doc = await uploadDocumentViaClient(file, {
      shouldRename: renameFlags[i] === true,
    });
    uploaded.push({
      ...doc,
      originalName: file.name,
      finalName: doc.name,
    });
  }
  return uploaded;
}
