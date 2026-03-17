// app/api/summarize/route.js
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const MAX_MODEL_INPUT_CHARS = Number.parseInt(
  process.env.SUMMARY_MAX_INPUT_CHARS || "12000",
  10
);
const EXTRACT_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.SUMMARY_EXTRACT_CONCURRENCY || "2", 10) || 2
);

const openaiClient =
  process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const deepseekClient =
  process.env.DEEPSEEK_API_KEY
    ? new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
      })
    : null;

const geminiClient =
  process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// ── Text extraction ───────────────────────────────────────

async function fetchBlobBuffer(url) {
  // Private Vercel Blob URLs require the SDK's get() with auth (plain fetch returns HTML/403)
  // allow Vercel Blob to cache where possible; large docs are expensive to refetch
  const result = await get(url, { access: "private", useCache: true });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Failed to fetch blob");
  }
  const res = new Response(result.stream);
  return Buffer.from(await res.arrayBuffer());
}

async function extractText(url, type) {
  const buffer = await fetchBlobBuffer(url);

  switch (type.toUpperCase()) {
    case "PDF": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await unpdfExtractText(pdf, { mergePages: true });
      return text || "";
    }

    case "DOCX":
    case "DOC": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    case "TXT":
    case "MD":
    case "CSV": {
      return buffer.toString("utf-8");
    }

    case "PPTX":
    case "PPT": {
      // pptx is a zip — extract text from slide XMLs
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      let text = "";
      const slideFiles = Object.keys(zip.files).filter(
        (f) => f.startsWith("ppt/slides/slide") && f.endsWith(".xml")
      );
      for (const slideFile of slideFiles) {
        const xml = await zip.files[slideFile].async("string");
        // Strip XML tags, keep text content
        text += xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") + "\n";
      }
      return text;
    }

    case "XLSX":
    case "XLS": {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      let text = "";
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += `Sheet: ${sheetName}\n`;
        text += XLSX.utils.sheet_to_csv(sheet) + "\n";
      }
      return text;
    }

    default:
      return buffer.toString("utf-8");
  }
}

function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    Promise.resolve()
      .then(job.fn)
      .then(job.resolve, job.reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

// ── AI call ───────────────────────────────────────────────
// Models used:
// - ChatGPT: gpt-4o (OpenAI; paid after free credits). For more free usage use gpt-4o-mini.
// - DeepSeek: deepseek-chat (free tier at platform.deepseek.com).
// - Gemini: tries Flash models first (free tier at aistudio.google.com). Override with GEMINI_MODEL in .env.

async function callAI(model, modelVariant, systemPrompt, documentText) {
  const clipped = (documentText || "").slice(0, MAX_MODEL_INPUT_CHARS);
  const fullPrompt = `${systemPrompt}\n\n---\n\nDocument Content:\n${clipped}`;

  if (model === "chatgpt") {
    const openaiModel = modelVariant || process.env.OPENAI_MODEL || "gpt-4o";
    if (!openaiClient) throw new Error("OPENAI_API_KEY is not set");
    const res = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 2000,
    });
    return res.choices[0].message.content;
  }

  if (model === "deepseek") {
    const deepseekModel = modelVariant || "deepseek-chat";
    if (!deepseekClient) throw new Error("DEEPSEEK_API_KEY is not set");
    const res = await deepseekClient.chat.completions.create({
      model: deepseekModel,
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 2000,
    });
    return res.choices[0].message.content;
  }

  if (model === "gemini") {
    if (!geminiClient) throw new Error("GEMINI_API_KEY is not set");

    const modelCandidates = modelVariant
      ? [modelVariant]
      : [
          process.env.GEMINI_MODEL,
          "gemini-2.0-flash",
          "gemini-1.5-flash",
          "gemini-2.5-flash",
          "gemini-flash-latest",
          "gemini-1.5-pro",
        ].filter(Boolean);

    const seen = new Set();
    const uniqueCandidates = modelCandidates.filter((m) => {
      if (seen.has(m)) return false;
      seen.add(m);
      return true;
    });

    let lastErr;
    for (const modelName of uniqueCandidates) {
      try {
        const geminiModel = geminiClient.getGenerativeModel({ model: modelName });
        const res = await geminiModel.generateContent(fullPrompt);
        return res.response.text();
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || err);
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `Gemini model unavailable. Last error: ${String(lastErr?.message || lastErr)}`
    );
  }

  throw new Error("Unknown model: " + model);
}

// ── Route handler ─────────────────────────────────────────

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session?.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentIds, model, modelVariant, summarizeFor, prompt } = await req.json();

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json({ error: "No documents selected" }, { status: 400 });
    }

    // Fetch documents from DB
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, userId: user.id },
      select: { id: true, name: true, url: true, type: true },
    });

    if (documents.length === 0) {
      return NextResponse.json({ error: "Documents not found" }, { status: 404 });
    }

    // Build system prompt based on summarizeFor
    const systemPrompt = `You are a document summarization assistant.
${summarizeFor === "lecturer"
  ? "Create a detailed, comprehensive summary with full explanations, technical depth, and complete context. Include all important concepts, methodologies, and details."
  : "Create a simplified, student-friendly summary focusing only on the most important key points. Use clear language, bullet points where helpful, and avoid unnecessary complexity."
}
${prompt ? `\nAdditional instructions: ${prompt}` : ""}
Format your response in clean markdown with clear sections.`;

    // Extract text with limited concurrency, and stop early once we have enough characters
    const limit = createLimiter(EXTRACT_CONCURRENCY);
    const extracted = await Promise.all(
      documents.map((doc) =>
        limit(async () => {
          const text = await extractText(doc.url, doc.type);
          return { doc, text: text || "" };
        })
      )
    );

    let combinedText = "";
    for (const { doc, text } of extracted) {
      if (combinedText.length >= MAX_MODEL_INPUT_CHARS) break;
      combinedText += `\n\n=== ${doc.name} ===\n`;
      combinedText += text.slice(0, Math.max(0, MAX_MODEL_INPUT_CHARS - combinedText.length));
    }

    // Call AI (model = provider, modelVariant = exact model id)
    const output = await callAI(model, modelVariant || null, systemPrompt, combinedText);

    // Save summary to database (store "provider:variant" for display in history)
    const title = documents[0].name.replace(/\.[^/.]+$/, ""); // filename without ext
    const modelForDb = modelVariant ? `${model}:${modelVariant}` : model;
    const summary = await prisma.summary.create({
      data: {
        userId: user.id,
        title,
        model: modelForDb,
        summarizeFor,
        prompt: prompt || null,
        output,
        documents: {
          create: documents.map((doc) => ({ documentId: doc.id })),
        },
      },
    });

    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error("Summarize error:", err);
    return NextResponse.json({ error: "Summarization failed: " + err.message }, { status: 500 });
  }
}