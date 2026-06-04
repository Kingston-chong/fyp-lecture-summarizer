import { runChat, parseSummaryModel } from "@/lib/llmServer";
import { REVISION_SHEET_SYSTEM_PROMPT } from "@/lib/revisionSheetPrompt";
import { stripMarkdownFence } from "@/lib/stripMarkdownFence";

const MAX_SOURCE_CHARS = Number.parseInt(
  process.env.REVISION_SHEET_MAX_SOURCE_CHARS || "14000",
  10,
);
const MAX_OUTPUT_TOKENS = Number.parseInt(
  process.env.REVISION_SHEET_MAX_TOKENS || "8192",
  10,
);

/**
 * Generate revision / quick-notes markdown from summary source text.
 * @param {{ title: string; model: string; summarizeFor: string; sourceText: string }} params
 */
export async function generateRevisionSheetMarkdown({
  title,
  model: modelSaved,
  summarizeFor,
  sourceText,
}) {
  if (String(summarizeFor || "").toLowerCase() !== "student") {
    throw new Error("Quick notes are available for student summaries only.");
  }

  const trimmed = String(sourceText || "").trim();
  if (!trimmed) {
    throw new Error("Summary has no content to generate notes from.");
  }

  const { provider: model, variant } = parseSummaryModel(modelSaved);
  if (!model) {
    throw new Error("Summary model is not configured.");
  }

  const userPrompt = `Document title: ${title}

Source material (lecture summary / slide notes):
${trimmed.slice(0, MAX_SOURCE_CHARS)}

Create the full revision study notes document now, including the Quick Q&A section at the end.`;

  const raw = await runChat(
    model,
    variant,
    REVISION_SHEET_SYSTEM_PROMPT,
    [{ role: "user", content: userPrompt }],
    { maxTokens: MAX_OUTPUT_TOKENS },
  );

  const markdown = stripMarkdownFence(raw);
  if (!markdown.trim()) {
    throw new Error("Quick notes generation returned empty content.");
  }

  return {
    markdown,
    title: title || "Quick notes",
  };
}
