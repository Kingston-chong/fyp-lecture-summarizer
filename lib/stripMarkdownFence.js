/** Remove optional markdown code fences from LLM output. */
export function stripMarkdownFence(text) {
  let t = String(text || "").trim();
  if (!t.startsWith("```")) return t;
  t = t.replace(/^```(?:markdown|md)?\s*\n?/i, "");
  t = t.replace(/\n?```\s*$/i, "");
  return t.trim();
}
