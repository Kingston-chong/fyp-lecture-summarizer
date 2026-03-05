// app/api/summarize/route.js
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  const { text, model, summarizeFor, prompt } = await req.json();

  const systemPrompt = summarizeFor === "lecturer"
    ? "Create a detailed, comprehensive summary with full explanations."
    : "Create a simplified summary focusing only on key points.";

  const userPrompt = `${systemPrompt}\n\n${prompt || ""}\n\nDocument:\n${text}`;

  // ChatGPT
  if (model === "chatgpt") {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userPrompt }],
    });
    return Response.json({ output: res.choices[0].message.content });
  }

  // DeepSeek (uses OpenAI-compatible API)
  if (model === "deepseek") {
    const deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
    const res = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: userPrompt }],
    });
    return Response.json({ output: res.choices[0].message.content });
  }

  // Gemini
  if (model === "gemini") {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const res = await geminiModel.generateContent(userPrompt);
    return Response.json({ output: res.response.text() });
  }
}