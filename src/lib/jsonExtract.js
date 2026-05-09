/**
 * Parse JSON from LLM output, including markdown code fences.
 * @param {string} text
 * @returns {unknown}
 */
export function parseJsonFromLlm(text) {
  const t = String(text ?? "").trim();
  if (!t) throw new Error("Empty model response");

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : t;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
  }
  throw new Error("Could not parse JSON from model response");
}
