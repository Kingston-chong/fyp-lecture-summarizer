/** @param {{ role: string, content?: string, apiContent?: string, imagePreviews?: string[] }} m */
export function chatMessageToApiPayload(m) {
  if (m.role === "ai") {
    return { role: "assistant", content: m.content || "" };
  }
  const text = ((m.apiContent ?? m.content) || "").trim();
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
