import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  runChat,
  normalizeModelKey,
  parseSummaryModel,
} from "@/lib/llmServer";

const MAX_CONTEXT_CHARS = Number.parseInt(
  process.env.CHAT_MAX_CONTEXT_CHARS || "24000",
  10
);

/** @param {{ role: string, content: string }[]} msgs */
function sanitizeMessages(msgs) {
  const out = [];
  for (const m of msgs) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const content = String(m?.content ?? "").trim();
    if (!content) continue;
    out.push({ role, content });
  }
  if (out.length === 0) return null;
  if (out[out.length - 1].role !== "user") return null;
  return out;
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const summaryId = Number(body?.summaryId);
    const modelKey = normalizeModelKey(body?.model);
    const modelLabel = (body?.modelLabel || "").toString().trim() || null;
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];

    if (!Number.isFinite(summaryId) || summaryId <= 0) {
      return NextResponse.json({ error: "Invalid summary id" }, { status: 400 });
    }
    if (!modelKey) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    const messages = sanitizeMessages(rawMessages);
    if (!messages) {
      return NextResponse.json(
        { error: "Messages must be non-empty and end with a user message" },
        { status: 400 }
      );
    }

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true, output: true, model: true, title: true },
    });

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    const context = (summary.output || "").slice(0, MAX_CONTEXT_CHARS);
    const { provider: summaryProvider, variant: summaryVariant } = parseSummaryModel(summary.model);

    const useVariant =
      modelKey === summaryProvider && summaryVariant ? summaryVariant : null;

    const systemPrompt = `You are a helpful assistant for Slide2Notes. The user is discussing a generated lecture/document summary.

Use the summary below as your primary source. Answer clearly in markdown when formatting helps. If the answer is not supported by the summary, say so briefly and, if helpful, give a careful general explanation while labeling it as general knowledge.

--- Document title: ${summary.title || "Untitled"} ---

--- Summary (context) ---
${context}`;

    const lastUserMessage = messages[messages.length - 1];
    const reply = await runChat(modelKey, useVariant, systemPrompt, messages);
    const trimmed = String(reply ?? "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "The model returned an empty reply" }, { status: 502 });
    }

    // Persist the newest turn so refresh/resume keeps conversation context.
    // NOTE: we use raw SQL to avoid depending on regenerated Prisma client models.
    await prisma.$executeRaw`
      INSERT INTO ChatThread (userId, summaryId, createdAt, updatedAt)
      VALUES (${user.id}, ${summaryId}, NOW(), NOW())
      ON DUPLICATE KEY UPDATE updatedAt = NOW()
    `;

    const threadRow = await prisma.$queryRaw`
      SELECT id
      FROM ChatThread
      WHERE userId = ${user.id} AND summaryId = ${summaryId}
      LIMIT 1
    `;
    const threadId = Number(threadRow?.[0]?.id);

    const nextTurnRow = await prisma.$queryRaw`
      SELECT COALESCE(MAX(turn), -1) AS maxTurn
      FROM ChatMessage
      WHERE threadId = ${threadId}
    `;
    const nextTurn = Number(nextTurnRow?.[0]?.maxTurn) + 1;

    await prisma.$executeRaw`
      INSERT INTO ChatMessage (threadId, turn, role, content, modelLabel, createdAt)
      VALUES
        (${threadId}, ${nextTurn}, 'user', ${lastUserMessage.content}, NULL, NOW()),
        (${threadId}, ${nextTurn + 1}, 'assistant', ${trimmed}, ${modelLabel}, NOW())
    `;

    return NextResponse.json({ reply: trimmed });
  } catch (err) {
    console.error("Chat error:", err);
    const msg = err?.message || "Chat failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
