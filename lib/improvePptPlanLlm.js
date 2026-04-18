import { parseJsonFromLlm } from "@/lib/jsonExtract";
import { runChat } from "@/lib/llmServer";

/**
 * @param {string} modelKey
 * @param {"content"|"style"} mode
 * @param {string} instructions
 * @param {{ index: number; text: string; lines: string[] }[]} slides
 * @returns {Promise<object[]>} adjustments array
 */
export async function runImprovePlanAdjustments(modelKey, mode, instructions, slides) {
  const systemPrompt = `You are a presentation planning assistant for Slide2Notes.
You list concrete adjustments to match the user's goals. Output ONLY valid JSON, no markdown outside JSON.`;

  const userContent = `Improvement mode: "${mode}".
- style = visual appearance: colors, themes, images, layout polish (not rewriting meaning unless the user asked).
- content = slide wording for teaching: clearer structure, substantive bullets, richer speaker notes; do NOT plan for aggressive shortening unless the user explicitly asked for shorter on-slide text.

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
