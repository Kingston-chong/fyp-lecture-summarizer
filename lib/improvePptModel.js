import { normalizeModelKey } from "@/lib/llmServer";

/** Map UI labels like "ChatGPT" to internal keys. */
export function uiModelToKey(label) {
  const x = String(label || "").trim().toLowerCase();
  if (x.includes("chatgpt") || x === "gpt") return "chatgpt";
  if (x.includes("deepseek")) return "deepseek";
  if (x.includes("gemini")) return "gemini";
  return normalizeModelKey(label);
}
