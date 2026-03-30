/**
 * Shared chat completion routing (OpenRouter preferred, else direct APIs).
 * Used by app/api/chat and improve-ppt routes.
 */
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const MAX_REPLY_TOKENS = Number.parseInt(
  process.env.CHAT_MAX_TOKENS || "4096",
  10
);

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const deepseekClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    })
  : null;

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const openrouterClient = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        ...(process.env.OPENROUTER_HTTP_REFERER && {
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER,
        }),
        ...(process.env.OPENROUTER_APP_NAME && { "X-Title": process.env.OPENROUTER_APP_NAME }),
      },
    })
  : null;

const GEMINI_VARIANT_TO_OPENROUTER = {
  "gemini-2.0-flash": "google/gemini-2.0-flash-001",
  "gemini-1.5-flash": "google/gemini-flash-1.5",
  "gemini-1.5-pro": "google/gemini-pro-1.5",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
};

function openRouterModelSlug(model, modelVariant) {
  if (model === "chatgpt") {
    const v = modelVariant || process.env.OPENAI_MODEL || "gpt-4o";
    return v.includes("/") ? v : `openai/${v}`;
  }
  if (model === "deepseek") {
    const v = modelVariant || "deepseek-chat";
    if (v.includes("/")) return v;
    return v.startsWith("deepseek/") ? v : `deepseek/${v}`;
  }
  if (model === "gemini") {
    if (modelVariant && modelVariant.includes("/")) return modelVariant;
    if (modelVariant && GEMINI_VARIANT_TO_OPENROUTER[modelVariant]) {
      return GEMINI_VARIANT_TO_OPENROUTER[modelVariant];
    }
    const fromEnv = process.env.GEMINI_MODEL;
    if (fromEnv?.includes("/")) return fromEnv;
    if (fromEnv && GEMINI_VARIANT_TO_OPENROUTER[fromEnv]) {
      return GEMINI_VARIANT_TO_OPENROUTER[fromEnv];
    }
    return "google/gemini-2.0-flash-001";
  }
  throw new Error("Unknown model: " + model);
}

function isOpenRouterModelNotFound(err) {
  const msg = String(err?.message || err);
  return msg.includes("404") || msg.toLowerCase().includes("not found");
}

export function normalizeModelKey(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "chatgpt" || s === "gpt") return "chatgpt";
  if (s === "deepseek") return "deepseek";
  if (s === "gemini") return "gemini";
  return null;
}

/** @param {string} stored e.g. "gemini:gemini-2.0-flash" */
export function parseSummaryModel(stored) {
  const s = String(stored || "");
  const idx = s.indexOf(":");
  if (idx === -1) return { provider: normalizeModelKey(s), variant: null };
  const provider = normalizeModelKey(s.slice(0, idx));
  const variant = s.slice(idx + 1).trim() || null;
  return { provider, variant };
}

async function callOpenRouterChat(model, modelVariant, systemPrompt, messages) {
  if (!openrouterClient) throw new Error("OPENROUTER_API_KEY is not set");

  const primary = openRouterModelSlug(model, modelVariant);
  const geminiExtras =
    model === "gemini"
      ? [
          process.env.OPENROUTER_GEMINI_MODEL,
          "google/gemini-2.0-flash-001",
          "google/gemini-flash-1.5",
          "google/gemini-2.5-flash",
          "google/gemini-pro-1.5",
        ].filter(Boolean)
      : [];

  const seen = new Set();
  const slugs = [];
  for (const s of [primary, ...geminiExtras]) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    slugs.push(s);
  }

  const payloadMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let lastErr;
  for (const slug of slugs) {
    try {
      const res = await openrouterClient.chat.completions.create({
        model: slug,
        messages: payloadMessages,
        max_tokens: MAX_REPLY_TOKENS,
      });
      const text = res.choices[0]?.message?.content;
      if (text != null && String(text).trim()) return text;
      lastErr = new Error("empty response");
    } catch (err) {
      lastErr = err;
      if (model === "gemini" && isOpenRouterModelNotFound(err)) continue;
      throw err;
    }
  }

  throw new Error(
    model === "gemini"
      ? `OpenRouter Gemini model unavailable. Last error: ${String(lastErr?.message || lastErr)}`
      : `OpenRouter request failed: ${String(lastErr?.message || lastErr)}`
  );
}

async function callDirectChat(model, modelVariant, systemPrompt, messages) {
  const payloadMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  if (model === "chatgpt") {
    const openaiModel = modelVariant || process.env.OPENAI_MODEL || "gpt-4o";
    if (!openaiClient) throw new Error("OPENAI_API_KEY is not set");
    const res = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: payloadMessages,
      max_tokens: MAX_REPLY_TOKENS,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (model === "deepseek") {
    const deepseekModel = modelVariant || "deepseek-chat";
    if (!deepseekClient) throw new Error("DEEPSEEK_API_KEY is not set");
    const res = await deepseekClient.chat.completions.create({
      model: deepseekModel,
      messages: payloadMessages,
      max_tokens: MAX_REPLY_TOKENS,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (model === "gemini") {
    if (!geminiClient) throw new Error("GEMINI_API_KEY is not set");

    const modelCandidates = modelVariant
      ? [modelVariant]
      : [
          process.env.GEMINI_MODEL,
          "gemini-2.0-flash",
          "gemini-1.5-flash",
          "gemini-2.5-flash",
          "gemini-flash-latest",
          "gemini-1.5-pro",
        ].filter(Boolean);

    const seen = new Set();
    const uniqueCandidates = modelCandidates.filter((m) => {
      if (seen.has(m)) return false;
      seen.add(m);
      return true;
    });

    const prior = messages.slice(0, -1);
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") throw new Error("Invalid message state");

    let lastErr;
    for (const modelName of uniqueCandidates) {
      try {
        const genModel = geminiClient.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });
        const history = prior.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const chat = genModel.startChat({ history });
        const result = await chat.sendMessage(last.content);
        const text = result.response.text();
        if (text != null && String(text).trim()) return text;
        lastErr = new Error("empty response");
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || err);
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `Gemini model unavailable. Last error: ${String(lastErr?.message || lastErr)}`
    );
  }

  throw new Error("Unknown model: " + model);
}

/**
 * @param {string} model
 * @param {string|null} modelVariant
 * @param {string} systemPrompt
 * @param {{ role: string, content: string }[]} messages
 */
export async function runChat(model, modelVariant, systemPrompt, messages) {
  if (openrouterClient) {
    return callOpenRouterChat(model, modelVariant, systemPrompt, messages);
  }
  return callDirectChat(model, modelVariant, systemPrompt, messages);
}
