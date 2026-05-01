import { normalizeTemplateSpec } from "@/lib/pptxTemplateSpec";

/**
 * Pick a safe template spec in priority order:
 * 1) incoming (theme-search), 2) resolved (llm/builtin), 3) builtin fallback.
 */
export function selectSafeTemplateSpec({ incomingSpec, resolvedSpec, builtinFallback }) {
  const incoming = normalizeTemplateSpec(incomingSpec);
  if (incoming.ok && incoming.spec) return { spec: incoming.spec, source: "incoming" };

  const resolved = normalizeTemplateSpec(resolvedSpec);
  if (resolved.ok && resolved.spec) return { spec: resolved.spec, source: "resolved" };

  const builtin = normalizeTemplateSpec(builtinFallback);
  if (builtin.ok && builtin.spec) return { spec: builtin.spec, source: "builtin_fallback" };

  return { spec: null, source: "none" };
}
