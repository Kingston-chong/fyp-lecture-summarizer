import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { runChat, normalizeModelKey } from "@/lib/llmServer";
import { parseJsonFromLlm } from "@/lib/jsonExtract";

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { 
      summaryId, 
      model, 
      numQuestions, 
      difficulty, 
      questionTypes, 
      focusAreas,
      generationMode
    } = body;

    if (!summaryId) {
      return NextResponse.json({ error: "Missing summaryId" }, { status: 400 });
    }

    const summary = await prisma.summary.findUnique({
      where: { id: Number(summaryId), userId: user.id },
      select: { output: true, title: true },
    });

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    const modelKey = normalizeModelKey(model) || "gemini";
    
    // Construct the prompt
    const systemPrompt = `You are an expert educational quiz generator. 
Your task is to generate a high-quality quiz based on the provided document summary.

Settings:
- Number of questions: ${numQuestions || 10}
- Difficulty: ${difficulty || "Medium"}
- Question Types: ${questionTypes?.join(", ") || "MCQ"}
- Focus Areas: ${focusAreas?.join(", ") || "Key concepts"}
- Generation Mode: ${generationMode || "Strict"} (if "Strict", only use info from the summary. If "Creative", you can add related context).

Output Format:
You MUST return a JSON array of question objects. Each object must have:
- question: (string) The question text.
- type: (string) One of: "MCQ", "True/False", "FillInBlanks", "ShortAnswer", "Match".
- options: (array of strings or null) For MCQ, provide exactly 4 options. For Match, provide an array of objects { key: string, value: string }. For others, null.
- answer: (string) The correct answer text. For MCQ/Match, this should match one of the options/values.
- explanation: (string) A brief explanation of why the answer is correct.

Return ONLY the JSON array. Do not include any other text.`;

    const userPrompt = `Document Title: ${summary.title}

Summary Content:
${summary.output}

Generate the quiz now.`;

    const aiResponse = await runChat(modelKey, null, systemPrompt, [{ role: "user", content: userPrompt }]);
    const questions = parseJsonFromLlm(aiResponse);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid response from AI: Expected a JSON array of questions.");
    }

    // Save to DB
    const quizSet = await prisma.quizSet.create({
      data: {
        userId: user.id,
        summaryId: Number(summaryId),
        title: `Quiz for ${summary.title}`,
        settings: {
          model,
          numQuestions,
          difficulty,
          questionTypes,
          focusAreas,
          generationMode
        },
        questions: {
          create: questions.map((q, idx) => ({
            question: q.question,
            type: q.type,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            order: idx
          }))
        }
      },
      include: {
        questions: true
      }
    });

    return NextResponse.json({ success: true, quizSet });
  } catch (err) {
    console.error("Quiz generation error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate quiz" }, { status: 500 });
  }
}
