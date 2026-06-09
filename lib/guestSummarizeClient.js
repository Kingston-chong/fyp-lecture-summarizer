import { consumeSummarizeSse } from "@/lib/consumeSummarizeSse";
import { saveGuestSummarySession } from "@/lib/guestSessionStorage";

/**
 * @param {File[]} files
 * @param {{
 *   model: string;
 *   modelVariant: string | null;
 *   summarizeFor: string;
 *   prompt?: string;
 *   publishedYearMode?: string;
 *   publishedYearFrom?: number | null;
 *   publishedYearTo?: number | null;
 *   onStatus?: (payload: { phase?: string; step?: string; [key: string]: unknown }) => void;
 *   onChunk?: (text: string) => void;
 *   onError?: (message: string) => void;
 * }} options
 */
export async function runGuestSummarizeStream(files, options) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  formData.append("model", options.model);
  if (options.modelVariant) {
    formData.append("modelVariant", options.modelVariant);
  }
  formData.append("summarizeFor", options.summarizeFor);
  formData.append("outputLength", options.outputLength || "medium");
  formData.append("prompt", options.prompt || "");
  formData.append("publishedYearMode", options.publishedYearMode || "all");
  if (options.publishedYearFrom != null) {
    formData.append("publishedYearFrom", String(options.publishedYearFrom));
  }
  if (options.publishedYearTo != null) {
    formData.append("publishedYearTo", String(options.publishedYearTo));
  }

  const res = await fetch("/api/summarize/guest", {
    method: "POST",
    body: formData,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Summarization failed");
  }
  if (!contentType.includes("text/event-stream") || !res.body) {
    throw new Error("Unexpected response from server");
  }

  let title = files[0]?.name?.replace(/\.[^/.]+$/, "") || "Summary";
  let output = "";
  let meta = {};

  await consumeSummarizeSse(res.body, {
    onStatus: (payload) => options.onStatus?.(payload),
    onMeta: (payload) => {
      meta = payload || {};
      if (payload?.title) title = payload.title;
    },
    onChunk: (text) => {
      output += text;
      options.onChunk?.(text);
    },
    onDone: (payload) => {
      if (payload?.output) output = payload.output;
    },
    onError: (message) => options.onError?.(message),
  });

  const session = {
    title,
    output,
    summarizeFor: options.summarizeFor,
    model: options.modelVariant
      ? `${options.model}:${options.modelVariant}`
      : options.model,
    fileNames: files.map((f) => f.name),
  };
  saveGuestSummarySession(session);

  return { ...session, meta };
}
