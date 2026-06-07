"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { MODEL_PROVIDERS } from "@/app/dashboard/helpers";
import { swrFetcher } from "@/lib/swrFetcher";

/**
 * @returns {{
 *   loading: boolean,
 *   providers: string[] | null,
 *   labels: string[] | null,
 *   defaultProvider: string,
 *   defaultLabel: string,
 *   isProviderAvailable: (id: string) => boolean,
 *   isLabelAvailable: (label: string) => boolean,
 * }}
 */
export function useLlmProviders() {
  const { data, isLoading } = useSWR("/api/llm-providers", swrFetcher, {
    revalidateOnFocus: false,
  });

  const providers = data?.providers ?? null;
  const labels = data?.labels ?? null;
  const defaultProvider = data?.defaultProvider ?? "gemini";
  const defaultLabel = data?.defaultLabel ?? "Gemini";

  const isProviderAvailable = useMemo(() => {
    return (id) => {
      if (!providers) return true;
      return providers.includes(id);
    };
  }, [providers]);

  const isLabelAvailable = useMemo(() => {
    return (label) => {
      if (!labels) return true;
      return labels.includes(label);
    };
  }, [labels]);

  return {
    loading: isLoading && !data,
    providers,
    labels,
    defaultProvider,
    defaultLabel,
    isProviderAvailable,
    isLabelAvailable,
  };
}

/** Auto-select first configured provider when current choice is unavailable. */
export function useEnsureLlmProvider(providerId, setProviderId, llm) {
  useEffect(() => {
    if (!llm.providers || llm.isProviderAvailable(providerId)) return;
    setProviderId(llm.defaultProvider);
  }, [llm.providers, llm.defaultProvider, llm.isProviderAvailable, providerId, setProviderId]);
}

/** Auto-select first configured UI label (ChatGPT / DeepSeek / Gemini). */
export function useEnsureUiModelLabel(label, setLabel, llm) {
  useEffect(() => {
    if (!llm.labels || llm.isLabelAvailable(label)) return;
    setLabel(llm.defaultLabel);
  }, [llm.labels, llm.defaultLabel, llm.isLabelAvailable, label, setLabel]);
}

export function filterModelProviders(allProviders, isAvailable) {
  return allProviders.map((p) => ({
    ...p,
    unavailable: !isAvailable(p.id),
  }));
}
