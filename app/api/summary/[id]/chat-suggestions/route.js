import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { runChat, parseSummaryModel } from "@/lib/llmServer";
import { buildChatSuggestions } from "@/lib/chatSuggestionsFromSummary";
import { normalizeSummarizeRole } from "@/lib/roleProfiles";

function parseId(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractHeadings(markdown) {
  const out = [];
  const re = /^(#{1,3})\s+(.+)$/gm;
  let m;
  while ((m = re.exec(String(markdown || "")))) {
    const text = String(m[2] || "").trim();
    if (text) out.push({ text });
  }
  return out;
}

function safeParseSuggestions(raw, max) {
  const hardMax = Math.min(5, Math.max(1, Number(max) || 4));
  const text = String(raw || "").trim();
  if (!text) return [];

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        parsed = JSON.parse(arrMatch[0]);
      } catch {
        parsed = null;
      }
    }
  }

  const arr = Array.isArray(parsed) ? parsed : [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const s = String(item || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!s || s.length > 220) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= hardMax) break;
  }
  return out;
}

export async function POST(req, ctx) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summaryId = parseId((await ctx.params)?.id);
    if (!summaryId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const max = Math.min(5, Math.max(1, Number(body?.max) || 4));

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: {
        id: true,
        title: true,
        output: true,
        model: true,
        summarizeFor: true,
      },
    });
    if (!summary) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const markdown = String(summary.output || "").trim();
    const headings = extractHeadings(markdown);
    const role = normalizeSummarizeRole(summary.summarizeFor);
    const fallback = buildChatSuggestions({
      markdown,
      headings,
      title: summary.title || "",
      max,
      role,
    });
    if (!markdown) return NextResponse.json({ suggestions: fallback });

    const { provider, variant } = parseSummaryModel(summary.model);
    const model = provider || "chatgpt";
    const context = markdown.slice(0, 12000);
    const title = String(summary.title || "Untitled");

    const audienceLine =
      role === "lecturer"
        ? `You generate short follow-up chat prompts for a lecturer preparing or refining a lecture from this summary.
           Favor: citations/references with links, evidence gaps, teaching angles, slide vs speaker-note split, graduate-level depth.
           Include at least one prompt about finding sources or references when relevant.`
        : `You generate short, useful follow-up chat questions for a student reviewing a summary.
           Favor: simpler explanations, exam prep, key takeaways, examples, and study-oriented depth.`;

    const prompt = `${audienceLine}
                    Return ONLY a JSON array of ${max} strings.
                    Rules:
                    - Each question must be specific to the summary topic.
                    - Keep each under 120 characters.
                    - No numbering, no markdown, no explanations.
                    - Avoid duplicates and vague prompts.

                    Summary title: ${title}
                    Summary content:
                    ${context}`;

    const reply = await runChat(model, variant, prompt, [
      {
        role: "user",
        content: "Generate high-quality follow-up question suggestions now.",
      },
    ]);

    const aiSuggestions = safeParseSuggestions(reply, max);
    const suggestions = aiSuggestions.length ? aiSuggestions : fallback;
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("chat suggestions error:", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 },
    );
  }
}
