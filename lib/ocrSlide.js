import { runChat } from "@/lib/llmServer";

const SYSTEM =
  "You are an OCR assistant. Output only the extracted text, nothing else.";

const PROMPT = `Extract ALL text visible in this slide image.
Include: titles, bullet points, labels, captions, diagram annotations, table content, footer text.
Exclude: decorative shapes with no readable text.
Output plain text only — no JSON, no markdown, no commentary.
If there is no readable text, output exactly: [no text]`;

/**
 * @param {string} modelKey - e.g. "gemini", "chatgpt"
 * @param {string|null} modelVariant
 * @param {Buffer} pngBuffer
 * @returns {Promise<string>}
 */
export async function ocrSlideImage(modelKey, modelVariant, pngBuffer) {
  const base64 = pngBuffer.toString("base64");
  const dataUrl = `data:image/png;base64,${base64}`;

  const messages = [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: dataUrl } },
        { type: "text", text: PROMPT },
      ],
    },
  ];

  const raw = await runChat(modelKey, modelVariant, SYSTEM, messages, {
    maxTokens: 1024,
  });
  const text = String(raw || "").trim();
  return text === "[no text]" ? "" : text;
}
