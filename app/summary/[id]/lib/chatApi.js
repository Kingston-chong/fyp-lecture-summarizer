/** @param {{ name?: string }[] | undefined} attachedFiles */
export function buildAttachedFilesNotice(attachedFiles) {
  if (!Array.isArray(attachedFiles) || attachedFiles.length === 0) return "";
  const names = attachedFiles.map((f) => f?.name).filter(Boolean);
  if (!names.length) return "";
  return `Attached documents (full extracted text is in the "Attached Sources" section of your context): ${names.join(", ")}`;
}

/** @param {number[]} ids @param {number[]} added */
export function mergeChatDocumentIds(ids, added) {
  const set = new Set(
    (ids || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  for (const id of added || []) {
    const n = Number(id);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return [...set];
}

/** @param {{ role: string, content?: string, apiContent?: string, imagePreviews?: string[], attachedFiles?: { name?: string }[] }} m */
export function chatMessageToApiPayload(m) {
  if (m.role === "ai") {
    return { role: "assistant", content: m.content || "" };
  }
  let text = ((m.apiContent ?? m.content) || "").trim();
  if (!m.apiContent && m.attachedFiles?.length) {
    const notice = buildAttachedFilesNotice(m.attachedFiles);
    if (notice) text = text ? `${notice}\n\n${text}` : notice;
  }
  const urls = m.imagePreviews || [];
  if (urls.length === 0) {
    return { role: "user", content: text };
  }
  /** @type {{ type: string, text?: string, image_url?: { url: string } }[]} */
  const parts = [];
  if (text) parts.push({ type: "text", text });
  for (const url of urls) {
    parts.push({ type: "image_url", image_url: { url } });
  }
  return { role: "user", content: parts };
}

export function mapChatModelToApi(chatModel) {
  if (chatModel === "DeepSeek") return "deepseek";
  if (chatModel === "Gemini") return "gemini";
  return "chatgpt";
}
