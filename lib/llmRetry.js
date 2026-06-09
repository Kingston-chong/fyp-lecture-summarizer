/**
 * Shared LLM retry / fallback helpers (rate limits, quota, overload).
 */

/** @param {unknown} err */
function errorMessageChain(err) {
  const parts = [];
  let e = err;
  for (let i = 0; e && i < 5; i++) {
    if (e?.message) parts.push(String(e.message));
    e = e?.cause;
  }
  if (parts.length === 0) return String(err ?? "");
  return parts.join(" ");
}

/**
 * True when retrying another model or provider may succeed.
 * @param {unknown} err
 */
export function isRetriableLlmError(err) {
  const status = Number(err?.status ?? err?.statusCode ?? err?.code);
  if (status === 401 || status === 403) return false;
  if (status === 429 || status === 503 || status === 404) return true;

  const raw =
    errorMessageChain(err) ||
    err?.error?.message ||
    (typeof err?.error === "string" ? err.error : null) ||
    String(err);
  const msg = String(raw).toLowerCase();

  if (
    msg.includes("resource_exhausted") ||
    msg.includes("resource has been exhausted")
  )
    return true;
  if (
    msg.includes("quota") &&
    (msg.includes("exceed") ||
      msg.includes("exhausted") ||
      msg.includes("limit"))
  )
    return true;
  if (msg.includes("rate limit") || msg.includes("too many requests"))
    return true;
  if (msg.includes("overloaded") || msg.includes("capacity")) return true;
  if (
    msg.includes("per day") ||
    msg.includes("daily limit") ||
    msg.includes("requests per day")
  )
    return true;
  if (
    msg.includes(" 429 ") ||
    msg.startsWith("429") ||
    msg.includes("status: 429")
  )
    return true;
  if (msg.includes("not found") && msg.includes("model")) return true;
  return false;
}

/**
 * Provider order for summarize fallback (excludes primary).
 * @param {string} primaryModel
 * @param {() => string[]} getAvailable
 */
export function buildProviderFallbackChain(primaryModel, getAvailable) {
  const available = new Set(getAvailable());
  const order = ["chatgpt", "deepseek", "gemini"];
  const chain = [primaryModel];
  for (const id of order) {
    if (id !== primaryModel && available.has(id)) chain.push(id);
  }
  return chain;
}
