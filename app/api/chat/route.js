import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import {
  runChat,
  normalizeModelKey,
  parseSummaryModel,
} from "@/lib/llmServer";
import {
  fetchTavilyContextForChat,
  userRequestedBeyondSummaryWeb,
} from "@/lib/tavilySearch";
import { getRoleProfile, normalizeSummarizeRole } from "@/lib/roleProfiles";

const MAX_CONTEXT_CHARS = Number.parseInt(
  process.env.CHAT_MAX_CONTEXT_CHARS || "24000",
  10
);
const MAX_ATTACHMENT_CONTEXT_CHARS = Number.parseInt(
  process.env.CHAT_MAX_ATTACHMENT_CONTEXT_CHARS || "12000",
  10
);

async function fetchBlobBuffer(url) {
  const result = await get(url, { access: "private", useCache: true });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Failed to fetch blob");
  }
  const res = new Response(result.stream);
  return Buffer.from(await res.arrayBuffer());
}

async function extractDocumentText(url, type) {
  const buffer = await fetchBlobBuffer(url);
  switch (String(type || "").toUpperCase()) {
    case "PDF": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await unpdfExtractText(pdf, { mergePages: true });
      return text || "";
    }
    case "DOCX":
    case "DOC": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }
    case "TXT":
    case "MD":
    case "CSV":
      return buffer.toString("utf-8");
    case "PPTX":
    case "PPT": {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      let text = "";
      const slideFiles = Object.keys(zip.files).filter(
        (f) => f.startsWith("ppt/slides/slide") && f.endsWith(".xml")
      );
      for (const slideFile of slideFiles) {
        const xml = await zip.files[slideFile].async("string");
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

const MAX_CHAT_IMAGE_BYTES = Number.parseInt(
  process.env.CHAT_MAX_IMAGE_BYTES || "3500000",
  10
);

/** @param {unknown} content */
function userMessageTextForSearch(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter((p) => p?.type === "text")
    .map((p) => String(p?.text ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** @param {string} text */
function shouldFallbackToWeb(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return true;
  const signals = [
    "not in the summary",
    "not mentioned in the summary",
    "not provided in the summary",
    "based on the summary",
    "summary does not",
    "slides do not",
    "not enough context",
    "insufficient context",
    "i don't have enough",
    "i do not have enough",
    "cannot determine",
    "can't determine",
    "unable to determine",
    "not available in the provided",
  ];
  return signals.some((s) => t.includes(s));
}

/**
 * Stable fingerprint for regenerate sync (DB row vs client payload).
 * @param {unknown} raw
 */
function userMessageSyncFingerprint(raw) {
  if (typeof raw === "string") {
    if (raw.startsWith('{"v":1')) {
      try {
        const o = JSON.parse(raw);
        const t = String(o?.t ?? "").trim();
        const n = Number(o?.n) || 0;
        return `v1|${t}|${n}`;
      } catch {
        /* fall through */
      }
    }
    return `s|${String(raw).trim()}`;
  }
  if (!Array.isArray(raw)) return "";
  let t = "";
  let n = 0;
  for (const p of raw) {
    if (p?.type === "text") t += String(p?.text ?? "");
    if (p?.type === "image_url" && p?.image_url?.url) n += 1;
  }
  return `v1|${t.trim()}|${n}`;
}

/**
 * @param {string | unknown[]} content
 * @returns {string}
 */
function userMessageContentForDatabase(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let text = "";
  let n = 0;
  for (const p of content) {
    if (p?.type === "text" && String(p?.text ?? "").trim()) {
      const piece = String(p.text).trim();
      text = text ? `${text}\n${piece}` : piece;
    }
    if (p?.type === "image_url" && p?.image_url?.url) n += 1;
  }
  if (n > 0) {
    const t = text.trim() || "[Image message]";
    return JSON.stringify({ v: 1, t, n });
  }
  return text;
}

/** @param {string} dataUrl */
function dataUrlByteLength(dataUrl) {
  const idx = String(dataUrl).indexOf("base64,");
  if (idx === -1) return 0;
  const b64 = String(dataUrl).slice(idx + 7);
  return Math.floor((b64.length * 3) / 4);
}

/** @param {unknown[]} msgs @returns {string|null} */
function oversizedChatImageError(msgs) {
  for (const m of msgs) {
    if (m?.role !== "user") continue;
    const raw = m?.content;
    if (!Array.isArray(raw)) continue;
    for (const p of raw) {
      if (p?.type === "image_url" && p?.image_url?.url) {
        const url = String(p.image_url.url);
        if (
          url.startsWith("data:image/") &&
          dataUrlByteLength(url) > MAX_CHAT_IMAGE_BYTES
        ) {
          return "One or more pasted images are too large. Try a smaller image or lower resolution.";
        }
      }
    }
  }
  return null;
}

/**
 * @param {{ role: string, content: unknown }[]} msgs
 * @returns {{ role: 'assistant'|'user', content: string | object[] }[] | null}
 */
function sanitizeMessages(msgs) {
  const out = [];
  for (const m of msgs) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    if (role === "assistant") {
      const content = String(m?.content ?? "").trim();
      if (!content) continue;
      out.push({ role, content });
      continue;
    }
    const raw = m?.content;
    if (typeof raw === "string") {
      const content = raw.trim();
      if (!content) continue;
      out.push({ role: "user", content });
      continue;
    }
    if (!Array.isArray(raw)) continue;
    /** @type {{ type: string, text?: string, image_url?: { url: string } }[]} */
    const parts = [];
    for (const p of raw) {
      if (p?.type === "text" && String(p?.text ?? "").trim()) {
        parts.push({ type: "text", text: String(p.text).trim() });
      } else if (p?.type === "image_url" && p?.image_url?.url) {
        const url = String(p.image_url.url);
        if (!url.startsWith("data:image/")) continue;
        parts.push({ type: "image_url", image_url: { url } });
      }
    }
    if (parts.length === 0) continue;
    const hasText = parts.some((p) => p.type === "text");
    const hasImg = parts.some((p) => p.type === "image_url");
    if (!hasText && !hasImg) continue;
    out.push({ role: "user", content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts });
  }
  if (out.length === 0) return null;
  if (out[out.length - 1].role !== "user") return null;
  return out;
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const summaryId = Number(body?.summaryId);
    const modelKey = normalizeModelKey(body?.model);
    const modelLabel = (body?.modelLabel || "").toString().trim() || null;
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const imageSizeErr = oversizedChatImageError(rawMessages);
    if (imageSizeErr) {
      return NextResponse.json({ error: imageSizeErr }, { status: 413 });
    }
    const requestedDocIds = Array.isArray(body?.documentIds)
      ? body.documentIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [];

    /** @type {boolean|undefined} */
    const webSearchOverride = body?.webSearch;
    const regenerate = body?.regenerate === true;

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
      select: { id: true, output: true, model: true, title: true, summarizeFor: true },
    });

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    const context = (summary.output || "").slice(0, MAX_CONTEXT_CHARS);
    const summarizeRole = normalizeSummarizeRole(summary.summarizeFor);
    const roleProfile = getRoleProfile(summarizeRole);
    const { provider: summaryProvider, variant: summaryVariant } = parseSummaryModel(summary.model);

    const useVariant =
      modelKey === summaryProvider && summaryVariant ? summaryVariant : null;

    let attachmentContext = "";
    if (requestedDocIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: { id: { in: requestedDocIds }, userId: user.id },
        select: { id: true, name: true, url: true, type: true },
      });

      for (const doc of docs) {
        if (attachmentContext.length >= MAX_ATTACHMENT_CONTEXT_CHARS) break;
        try {
          const extracted = await extractDocumentText(doc.url, doc.type);
          if (!extracted) continue;
          const remaining = Math.max(
            0,
            MAX_ATTACHMENT_CONTEXT_CHARS - attachmentContext.length
          );
          attachmentContext += `\n\n=== ${doc.name} ===\n`;
          attachmentContext += extracted.slice(0, remaining);
        } catch (e) {
          console.warn(`Could not extract chat attachment "${doc.name}":`, e?.message);
        }
      }
    }

    const lastUserMessage = messages[messages.length - 1];
    const lastUserSearchText = userMessageTextForSearch(lastUserMessage.content);

    const webSearchKeyOk = Boolean(process.env.TAVILY_API_KEY);
    const webSearchGloballyOff = process.env.CHAT_WEB_SEARCH === "0";
    const toggleOn = webSearchOverride === true;
    const phraseOn = userRequestedBeyondSummaryWeb(lastUserSearchText);
    const autoWebEnabled = webSearchKeyOk && !webSearchGloballyOff;

    let webSearchSkippedReason = null;
    if (!autoWebEnabled && (toggleOn || phraseOn)) {
      if (!webSearchKeyOk) webSearchSkippedReason = "missing_tavily_key";
      else if (webSearchGloballyOff)
        webSearchSkippedReason = "web_search_disabled_env";
    }

    const buildSearchQuery = () => {
      const qUser = lastUserSearchText.trim().slice(0, 220);
      const qTitle = (summary.title || "").trim().slice(0, 80);
      const suffix =
        " Broader reference information beyond lecture notes only; include established facts not necessarily stated in the slides.";
      return [qUser, qTitle ? `(Topic: ${qTitle})` : "", suffix]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);
    };

    const roleSpecificRules = roleProfile.chatInstructions.map((line) => `- ${line}`).join("\n");
    const lecturerCitationRules =
      summarizeRole === "lecturer"
        ? `
Citation requirements for lecturer mode:
- Every meaningful factual claim should include one or more inline citation markers like [1], [2].
- Use available sources only: summary, attached sources, and web excerpts.
- End with a dedicated "References" section. Each reference must map to a marker and include source title plus URL/domain.
- If no source supports a claim, explicitly state uncertainty and do not fabricate references.
`
        : "";

    const buildSystemPrompt = (webContext = "") => `You are a helpful assistant for Slide2Notes. The user is discussing a generated lecture/document summary.
Audience mode: ${summarizeRole}.

The user may paste screenshots or diagrams into the chat; use what you see together with the summary when it is relevant.

Use the summary below as the authoritative source for what appears in their materials. Answer clearly in markdown when formatting helps.

When the user asks for elaboration, definitions, background organizations, or other details that are missing or only briefly mentioned in the summary:
- If a "Web search excerpts" section is present below, treat it as **external** evidence: prioritize facts that are **not already fully stated** in the summary. Do not merely paraphrase the summary using web snippets that only repeat the same points; add genuinely new information from the excerpts when available.
- Prefer citing web sources (markdown links) for claims that go beyond the summary text.
- If excerpts are empty, thin, or only restate what the summary already says, rely on the summary and careful general knowledge; label unsourced extrapolation as **Beyond the summary (general knowledge)**.
- If there is no web section, use careful, well-established general knowledge and label that part clearly as **Beyond the summary (general knowledge)**.

If the summary and web excerpts disagree on lecture-specific claims, prefer the summary for what the materials said, and note any conflict briefly.

Role-specific output rules:
${roleSpecificRules}
${lecturerCitationRules}

--- Document title: ${summary.title || "Untitled"} ---

--- Summary (context) ---
${context}
${webContext ? `\n\n--- Web search excerpts ---\n${webContext}` : ""}
${attachmentContext ? `\n\n--- Attached Sources (uploaded by user) ---\n${attachmentContext}` : ""}`;

    let webContext = "";
    let webSearchAttempted = false;

    let reply = await runChat(
      modelKey,
      useVariant,
      buildSystemPrompt(""),
      messages
    );
    let trimmed = String(reply ?? "").trim();

    const shouldTryWebFallback =
      autoWebEnabled && (toggleOn || phraseOn || shouldFallbackToWeb(trimmed));

    if (shouldTryWebFallback) {
      webSearchAttempted = true;
      webContext = await fetchTavilyContextForChat(buildSearchQuery());
      if (String(webContext || "").trim()) {
        reply = await runChat(
          modelKey,
          useVariant,
          buildSystemPrompt(webContext),
          messages
        );
        trimmed = String(reply ?? "").trim();
      }
    }

    if (!trimmed) {
      return NextResponse.json({ error: "The model returned an empty reply" }, { status: 502 });
    }

    const webContextIncluded = Boolean(webContext && String(webContext).trim());
    /** Client can show whether Tavily actually contributed text to the system prompt */
    const webSearch = webSearchAttempted
      ? { attempted: true, contextIncluded: webContextIncluded }
      : {
          attempted: false,
          contextIncluded: false,
          ...(webSearchSkippedReason
            ? { skippedReason: webSearchSkippedReason }
            : {}),
        };
    const hasReferencesSection = /\n#{0,3}\s*references\s*\n/i.test(trimmed);
    const finalReply =
      summarizeRole === "lecturer" && !hasReferencesSection
        ? `${trimmed}\n\n## References\n- No verifiable source references were produced for this response.`
        : trimmed;

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

    if (regenerate) {
      const lastTwo = await prisma.$queryRaw`
        SELECT turn, role, content
        FROM ChatMessage
        WHERE threadId = ${threadId}
        ORDER BY turn DESC
        LIMIT 2
      `;
      const latest = lastTwo?.[0];
      const prior = lastTwo?.[1];
      if (
        !latest ||
        String(latest.role) !== "assistant" ||
        !prior ||
        String(prior.role) !== "user"
      ) {
        return NextResponse.json(
          {
            error:
              "Cannot regenerate this reply. Try sending your message again.",
          },
          { status: 409 }
        );
      }
      const priorRaw = prior.content;
      const lastFp = userMessageSyncFingerprint(lastUserMessage.content);
      let regenMatch =
        userMessageSyncFingerprint(priorRaw) === lastFp;
      if (
        !regenMatch &&
        typeof priorRaw === "string" &&
        priorRaw.startsWith('{"v":1')
      ) {
        try {
          const o = JSON.parse(priorRaw);
          const priorText = String(o?.t ?? "").trim();
          const lastText = userMessageTextForSearch(lastUserMessage.content);
          regenMatch = priorText === lastText.trim();
        } catch {
          regenMatch = false;
        }
      }
      if (!regenMatch) {
        return NextResponse.json(
          {
            error:
              "Cannot regenerate: this chat is out of sync. Refresh the page.",
          },
          { status: 409 }
        );
      }
      const assistantTurn = Number(latest.turn);
      await prisma.$executeRaw`
        DELETE FROM ChatMessage
        WHERE threadId = ${threadId} AND turn = ${assistantTurn}
      `;
      await prisma.$executeRaw`
        INSERT INTO ChatMessage (threadId, turn, role, content, modelLabel, createdAt)
        VALUES (${threadId}, ${assistantTurn}, 'assistant', ${finalReply}, ${modelLabel}, NOW())
      `;
    } else {
      const nextTurnRow = await prisma.$queryRaw`
        SELECT COALESCE(MAX(turn), -1) AS maxTurn
        FROM ChatMessage
        WHERE threadId = ${threadId}
      `;
      const nextTurn = Number(nextTurnRow?.[0]?.maxTurn) + 1;

      const userRowContent = userMessageContentForDatabase(lastUserMessage.content);
      await prisma.$executeRaw`
        INSERT INTO ChatMessage (threadId, turn, role, content, modelLabel, createdAt)
        VALUES
          (${threadId}, ${nextTurn}, 'user', ${userRowContent}, NULL, NOW()),
          (${threadId}, ${nextTurn + 1}, 'assistant', ${finalReply}, ${modelLabel}, NOW())
      `;
    }

    return NextResponse.json({ reply: finalReply, webSearch });
  } catch (err) {
    console.error("Chat error:", err);
    const msg = err?.message || "Chat failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
