/**
 * Estimate and trim chat payloads so input + max_tokens fits model context.
 */

const SAFETY_TOKENS = 96;
const MIN_OUTPUT_TOKENS = 256;

/** @type {Record<string, number>} */
const MODEL_CONTEXT_WINDOWS = {
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4-turbo": 128_000,
  "gpt-4-turbo-preview": 128_000,
  "gpt-4-32k": 32_768,
  "gpt-4": 8192,
  "gpt-3.5-turbo-16k": 16_385,
  "gpt-3.5-turbo": 16_385,
  "o1": 128_000,
  "o1-mini": 128_000,
  "o3": 128_000,
  "o3-mini": 128_000,
  "deepseek-chat": 65_536,
  "deepseek-reasoner": 65_536,
  "gemini-2.5-pro": 1_048_576,
  "gemini-2.5-flash": 1_048_576,
  "gemini-3-flash-preview": 1_048_576,
  "gemini-3.1-flash-lite-preview": 1_048_576,
};

const CONTENT_MARKERS = [
  "Summary content:",
  "Lecture / slide content:",
  "Document text:",
  "Summary / slide content:",
  "Content:\n",
];

/**
 * Rough token estimate (~3.5 chars per token).
 * @param {unknown} text
 */
export function estimateTokens(text) {
  const s =
    typeof text === "string" ? text : text == null ? "" : JSON.stringify(text);
  if (!s) return 0;
  return Math.ceil(s.length / 3.5);
}

/**
 * @param {{ role: string; content?: unknown }[]} messages
 */
export function estimateMessagesTokens(messages) {
  return (messages || []).reduce((sum, m) => {
    const c = m?.content;
    if (typeof c === "string") return sum + estimateTokens(c) + 4;
    if (Array.isArray(c)) return sum + estimateTokens(JSON.stringify(c)) + 4;
    return sum + 4;
  }, 0);
}

/**
 * @param {string} model
 * @param {string | null | undefined} modelVariant
 */
export function resolveContextWindow(model, modelVariant) {
  const variant = String(modelVariant || "")
    .toLowerCase()
    .replace(/^openai\//, "")
    .replace(/^google\//, "");
  const envDefaults = {
    chatgpt: process.env.OPENAI_MODEL,
    gemini: process.env.GEMINI_MODEL,
    deepseek: "deepseek-chat",
  };
  const candidates = [
    variant,
    String(envDefaults[model] || "").toLowerCase(),
    model === "gemini" ? "gemini-2.5-flash" : "",
    model === "deepseek" ? "deepseek-chat" : "",
    model === "chatgpt" ? "gpt-4o" : "",
  ].filter(Boolean);

  const keysByLength = Object.keys(MODEL_CONTEXT_WINDOWS).sort(
    (a, b) => b.length - a.length,
  );
  for (const name of candidates) {
    if (MODEL_CONTEXT_WINDOWS[name]) return MODEL_CONTEXT_WINDOWS[name];
  }
  for (const name of candidates) {
    for (const key of keysByLength) {
      if (name.startsWith(key) || key.startsWith(name)) {
        return MODEL_CONTEXT_WINDOWS[key];
      }
    }
  }

  if (model === "gemini") return 1_048_576;
  if (model === "deepseek") return 65_536;
  return 8192;
}

/**
 * @param {number} inputTokens
 * @param {number | undefined} requestedMax
 * @param {number} contextWindow
 */
export function clampMaxTokens(inputTokens, requestedMax, contextWindow) {
  const want = Number.isFinite(requestedMax)
    ? /** @type {number} */ (requestedMax)
    : 4096;
  const budget = contextWindow - inputTokens - SAFETY_TOKENS;
  if (budget < MIN_OUTPUT_TOKENS) return MIN_OUTPUT_TOKENS;
  return Math.min(want, Math.max(MIN_OUTPUT_TOKENS, budget));
}

/** @param {unknown} err */
export function isContextLengthExceededError(err) {
  const code = err?.code || err?.error?.code;
  if (code === "context_length_exceeded") return true;
  const parts = [];
  let e = err;
  for (let i = 0; e && i < 5; i++) {
    if (e?.message) parts.push(String(e.message));
    e = e?.cause;
  }
  const msg = parts.join(" ").toLowerCase();
  return (
    msg.includes("maximum context length") ||
    (msg.includes("context length") && msg.includes("token")) ||
    msg.includes("context_length_exceeded")
  );
}

/**
 * @param {string} systemPrompt
 * @param {number} targetTokenBudget
 */
export function trimSystemPrompt(systemPrompt, targetTokenBudget) {
  let text = String(systemPrompt || "");
  if (estimateTokens(text) <= targetTokenBudget) return text;

  for (const marker of CONTENT_MARKERS) {
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    const head = text.slice(0, idx + marker.length);
    let body = text.slice(idx + marker.length);
    while (estimateTokens(head + body) > targetTokenBudget && body.length > 200) {
      body = body.slice(0, Math.floor(body.length * 0.7));
    }
    const trimmed = `${head}${body.trimEnd()}\n\n[…content trimmed to fit model context…]`;
    if (estimateTokens(trimmed) <= targetTokenBudget) return trimmed;
    text = trimmed;
    break;
  }

  while (estimateTokens(text) > targetTokenBudget && text.length > 200) {
    text = text.slice(0, Math.floor(text.length * 0.7));
  }
  return `${text.trimEnd()}\n\n[…trimmed to fit model context…]`;
}

/**
 * @param {string} systemPrompt
 * @param {{ role: string; content?: unknown }[]} messages
 * @param {number} maxTokens
 * @param {number} contextWindow
 * @param {{ aggressive?: boolean }} [opts]
 */
export function trimChatPayload(
  systemPrompt,
  messages,
  maxTokens,
  contextWindow,
  opts = {},
) {
  const inputBudget = contextWindow - maxTokens - SAFETY_TOKENS;
  const sysShare = opts.aggressive ? 0.7 : 0.88;
  let sys = String(systemPrompt || "");
  let msgs = [...(messages || [])];

  let inputTokens = estimateTokens(sys) + estimateMessagesTokens(msgs);
  if (inputTokens <= inputBudget) {
    return { systemPrompt: sys, messages: msgs };
  }

  const sysBudget = Math.max(400, Math.floor(inputBudget * sysShare));
  sys = trimSystemPrompt(sys, sysBudget);
  inputTokens = estimateTokens(sys) + estimateMessagesTokens(msgs);
  if (inputTokens <= inputBudget) {
    return { systemPrompt: sys, messages: msgs };
  }

  while (msgs.length > 1 && inputTokens > inputBudget) {
    msgs.shift();
    inputTokens = estimateTokens(sys) + estimateMessagesTokens(msgs);
  }

  const last = msgs[msgs.length - 1];
  if (inputTokens > inputBudget && last && typeof last.content === "string") {
    const charBudget = Math.max(
      200,
      Math.floor((inputBudget - estimateTokens(sys)) * 3.5),
    );
    msgs[msgs.length - 1] = {
      ...last,
      content:
        last.content.slice(0, charBudget).trimEnd() +
        "\n\n[…trimmed to fit model context…]",
    };
  }

  return { systemPrompt: sys, messages: msgs };
}

/**
 * @param {string} model
 * @param {string | null | undefined} modelVariant
 * @param {string} systemPrompt
 * @param {{ role: string; content?: unknown }[]} messages
 * @param {number | undefined} requestedMaxTokens
 */
export function prepareChatContextBudget(
  model,
  modelVariant,
  systemPrompt,
  messages,
  requestedMaxTokens,
) {
  const contextWindow = resolveContextWindow(model, modelVariant);
  let inputEst =
    estimateTokens(systemPrompt) + estimateMessagesTokens(messages);
  let maxTokens = clampMaxTokens(
    inputEst,
    requestedMaxTokens,
    contextWindow,
  );

  let trimmed = trimChatPayload(
    systemPrompt,
    messages,
    maxTokens,
    contextWindow,
  );
  inputEst =
    estimateTokens(trimmed.systemPrompt) +
    estimateMessagesTokens(trimmed.messages);
  maxTokens = clampMaxTokens(inputEst, requestedMaxTokens, contextWindow);

  return {
    contextWindow,
    maxTokens,
    systemPrompt: trimmed.systemPrompt,
    messages: trimmed.messages,
  };
}
