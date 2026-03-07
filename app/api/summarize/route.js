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

// ── Text extraction ───────────────────────────────────────

async function fetchBlobBuffer(url) {
  // Private Vercel Blob URLs require the SDK's get() with auth (plain fetch returns HTML/403)
  const result = await get(url, { access: "private", useCache: false });
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

// ── AI call ───────────────────────────────────────────────

async function callAI(model, systemPrompt, documentText) {
  const fullPrompt = `${systemPrompt}\n\n---\n\nDocument Content:\n${documentText.slice(0, 12000)}`; // limit tokens

  if (model === "chatgpt") {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 2000,
    });
    return res.choices[0].message.content;
  }

  if (model === "deepseek") {
    const deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
    const res = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 2000,
    });
    return res.choices[0].message.content;
  }

  if (model === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const modelCandidates = [
      process.env.GEMINI_MODEL, // allow overriding without code changes
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
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
        const geminiModel = genAI.getGenerativeModel({ model: modelName });
        const res = await geminiModel.generateContent(fullPrompt);
        return res.response.text();
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || err);
        // If the model is not available for this API key/version, try the next candidate.
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `Gemini model unavailable. Set GEMINI_MODEL to one your key can access. Last error: ${String(
        lastErr?.message || lastErr
      )}`
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    const { documentIds, model, summarizeFor, prompt } = await req.json();

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json({ error: "No documents selected" }, { status: 400 });
    }

    // Fetch documents from DB
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, userId: user.id },
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

    // Extract text from all documents and combine
    let combinedText = "";
    for (const doc of documents) {
      combinedText += `\n\n=== ${doc.name} ===\n`;
      const text = await extractText(doc.url, doc.type);
      combinedText += text;
    }

    // Call AI
    const output = await callAI(model, systemPrompt, combinedText);

    // Save summary to database
    const title = documents[0].name.replace(/\.[^/.]+$/, ""); // filename without ext
    const summary = await prisma.summary.create({
      data: {
        userId: user.id,
        title,
        model,
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