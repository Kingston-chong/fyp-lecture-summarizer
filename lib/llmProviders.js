/** @typedef {"chatgpt" | "deepseek" | "gemini"} LlmProviderId */

export const LLM_PROVIDER_IDS = /** @type {const} */ ([
  "chatgpt",
  "deepseek",
  "gemini",
]);

export const UI_MODEL_LABELS = {
  chatgpt: "ChatGPT",
  deepseek: "DeepSeek",
  gemini: "Gemini",
};

const LABEL_TO_ID = {
  ChatGPT: "chatgpt",
  DeepSeek: "deepseek",
  Gemini: "gemini",
};

function hasEnvKey(name) {
  return Boolean(String(process.env[name] || "").trim());
}

/** OpenRouter proxies all providers when set. */
export function isOpenRouterEnabled() {
  return hasEnvKey("OPENROUTER_API_KEY");
}

/** @param {string} providerId */
export function isLlmProviderAvailable(providerId) {
  if (isOpenRouterEnabled()) return true;

  if (providerId === "chatgpt") return hasEnvKey("OPENAI_API_KEY");
  if (providerId === "deepseek") return hasEnvKey("DEEPSEEK_API_KEY");
  if (providerId === "gemini") return hasEnvKey("GEMINI_API_KEY");
  return false;
}

/** @returns {LlmProviderId[]} */
export function getAvailableLlmProviders() {
  return LLM_PROVIDER_IDS.filter((id) => isLlmProviderAvailable(id));
}

/** @returns {LlmProviderId} */
export function getDefaultLlmProvider() {
  const available = getAvailableLlmProviders();
  if (available.includes("chatgpt")) return "chatgpt";
  if (available.includes("gemini")) return "gemini";
  if (available.includes("deepseek")) return "deepseek";
  return "chatgpt";
}

export function getDefaultUiModelLabel() {
  return UI_MODEL_LABELS[getDefaultLlmProvider()];
}

/** @param {string} label */
export function uiLabelToProviderId(label) {
  return LABEL_TO_ID[label] || null;
}

/** @param {string} label */
export function isUiModelLabelAvailable(label) {
  const id = uiLabelToProviderId(label);
  return id ? isLlmProviderAvailable(id) : false;
}

export function getLlmProvidersConfig() {
  const providers = getAvailableLlmProviders();
  const defaultProvider = getDefaultLlmProvider();
  return {
    providers,
    labels: providers.map((id) => UI_MODEL_LABELS[id]),
    defaultProvider,
    defaultLabel: UI_MODEL_LABELS[defaultProvider],
    openRouter: isOpenRouterEnabled(),
  };
}
