import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { runChat } from "@/lib/llmServer";

/**
 * @param {string} modelKey
 * @param {string} instructions
 * @param {{ index: number; text: string; lines: string[] }[]} slides
 * @returns {Promise<object[]>} adjustments array
 */
export async function runImprovePlanAdjustments(
  modelKey,
  instructions,
  slides,
) {
  const systemPrompt = `You are a presentation planning assistant for Slide2Notes.
You list concrete adjustments to match the user's goals. Output ONLY valid JSON, no markdown outside JSON.`;

  const userContent = `Infer what the user wants from their instructions alone (no separate "mode"):
- They may ask for visuals only (colors, theme, imagery, layout polish) — plan style-focused changes without assuming they want wording rewritten.
- They may ask for teaching/content (clearer bullets, richer speaker notes, examples) — plan context-focused changes.
- They may ask for both — include both kinds of adjustments.

User instructions:
${instructions}

Slides (index, text, lines):
${JSON.stringify(slides, null, 2)}

Return JSON exactly in this shape:
{
  "adjustments": [
    {
      "slideIndex": <number>,
      "type": "style" | "context",
      "description": "<what will change>",
      "before": "<short excerpt from current slide>",
      "after": "<optional: expected outcome or summary>"
    }
  ]
}

Include only slides that need changes. If nothing applies, return { "adjustments": [] }.`;

  const raw = await runChat(modelKey, null, systemPrompt, [
    { role: "user", content: userContent },
  ]);

  const parsed = parseJsonFromLlm(raw);
  return Array.isArray(parsed?.adjustments) ? parsed.adjustments : [];
}
