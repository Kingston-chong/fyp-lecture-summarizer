// app/api/summarize/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { extractDocumentText } from "@/lib/extractDocumentText";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildReferenceCatalog,
  fetchRelatedPapers,
} from "@/lib/academicSearch";
import {
  clampInvalidCitations,
  finalizeLecturerReferences,
  persistSummaryReferences,
} from "@/lib/referenceUtils";
import {
  getLecturerSummaryCitationRules,
  getRoleProfile,
  normalizeSummarizeRole,
} from "@/lib/roleProfiles";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { resolvePublishedYearRange } from "@/lib/publishedYearFilter";
import { SUMMARIZE_PHASE } from "@/lib/summarizeProgress";

const MAX_MODEL_INPUT_CHARS = Number.parseInt(
  process.env.SUMMARY_MAX_INPUT_CHARS || "12000",
  10,
);
const EXTRACT_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.SUMMARY_EXTRACT_CONCURRENCY || "2", 10) || 2,
);

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const deepseekClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    })
  : null;

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// OpenRouter: one key, OpenAI-compatible API (https://openrouter.ai/docs)
const openrouterClient = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL:
        process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        ...(process.env.OPENROUTER_HTTP_REFERER && {
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER,
        }),
        ...(process.env.OPENROUTER_APP_NAME && {
          "X-Title": process.env.OPENROUTER_APP_NAME,
        }),
      },
    })
  : null;

/** Maps dashboard Gemini variant ids to OpenRouter `provider/model` slugs */
const GEMINI_VARIANT_TO_OPENROUTER = {
  "gemini-2.0-flash": "google/gemini-2.0-flash-001",
  "gemini-1.5-flash": "google/gemini-flash-1.5",
  "gemini-1.5-pro": "google/gemini-pro-1.5",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
};

function openRouterModelSlug(model, modelVariant) {
  if (model === "chatgpt") {
    const v = modelVariant || process.env.OPENAI_MODEL || "gpt-4o";
    return v.includes("/") ? v : `openai/${v}`;
  }
  if (model === "deepseek") {
    const v = modelVariant || "deepseek-chat";
    if (v.includes("/")) return v;
    return v.startsWith("deepseek/") ? v : `deepseek/${v}`;
  }
  if (model === "gemini") {
    if (modelVariant && modelVariant.includes("/")) return modelVariant;
    if (modelVariant && GEMINI_VARIANT_TO_OPENROUTER[modelVariant]) {
      return GEMINI_VARIANT_TO_OPENROUTER[modelVariant];
    }
    const fromEnv = process.env.GEMINI_MODEL;
    if (fromEnv?.includes("/")) return fromEnv;
    if (fromEnv && GEMINI_VARIANT_TO_OPENROUTER[fromEnv]) {
      return GEMINI_VARIANT_TO_OPENROUTER[fromEnv];
    }
    return "google/gemini-2.0-flash-001";
  }
  throw new Error("Unknown model: " + model);
}

function isOpenRouterModelNotFound(err) {
  const msg = String(err?.message || err);
  return msg.includes("404") || msg.toLowerCase().includes("not found");
}

async function callOpenRouter(model, modelVariant, fullPrompt) {
  if (!openrouterClient) throw new Error("OPENROUTER_API_KEY is not set");

  const primary = openRouterModelSlug(model, modelVariant);
  const geminiExtras =
    model === "gemini"
      ? [
          process.env.OPENROUTER_GEMINI_MODEL,
          "google/gemini-2.0-flash-001",
          "google/gemini-flash-1.5",
          "google/gemini-2.5-flash",
          "google/gemini-pro-1.5",
        ].filter(Boolean)
      : [];

  const seen = new Set();
  const slugs = [];
  for (const s of [primary, ...geminiExtras]) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    slugs.push(s);
  }

  let lastErr;
  for (const slug of slugs) {
    try {
      const res = await openrouterClient.chat.completions.create({
        model: slug,
        messages: [{ role: "user", content: fullPrompt }],
        max_tokens: 2000,
      });
      const text = res.choices[0]?.message?.content;
      if (text != null) return text;
      if (model !== "gemini") {
        throw new Error("OpenRouter returned empty content");
      }
      lastErr = new Error("empty response");
    } catch (err) {
      lastErr = err;
      if (model === "gemini" && isOpenRouterModelNotFound(err)) continue;
      throw err;
    }
  }

  throw new Error(
    model === "gemini"
      ? `OpenRouter Gemini model unavailable. Last error: ${String(lastErr?.message || lastErr)}`
      : `OpenRouter request failed: ${String(lastErr?.message || lastErr)}`,
  );
}

async function* callOpenRouterStream(model, modelVariant, fullPrompt) {
  if (!openrouterClient) throw new Error("OPENROUTER_API_KEY is not set");

  const primary = openRouterModelSlug(model, modelVariant);
  const geminiExtras =
    model === "gemini"
      ? [
          process.env.OPENROUTER_GEMINI_MODEL,
          "google/gemini-2.0-flash-001",
          "google/gemini-flash-1.5",
          "google/gemini-2.5-flash",
          "google/gemini-pro-1.5",
        ].filter(Boolean)
      : [];

  const seen = new Set();
  const slugs = [];
  for (const s of [primary, ...geminiExtras]) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    slugs.push(s);
  }

  let lastErr;
  for (const slug of slugs) {
    try {
      const stream = await openrouterClient.chat.completions.create({
        model: slug,
        messages: [{ role: "user", content: fullPrompt }],
        max_tokens: 2000,
        stream: true,
      });
      let emitted = false;
      for await (const chunk of stream) {
        const text = chunk?.choices?.[0]?.delta?.content ?? "";
        if (!text) continue;
        emitted = true;
        yield text;
      }
      if (emitted || model !== "gemini") return;
      lastErr = new Error("empty response");
    } catch (err) {
      lastErr = err;
      if (model === "gemini" && isOpenRouterModelNotFound(err)) continue;
      throw err;
    }
  }

  throw new Error(
    model === "gemini"
      ? `OpenRouter Gemini model unavailable. Last error: ${String(lastErr?.message || lastErr)}`
      : `OpenRouter request failed: ${String(lastErr?.message || lastErr)}`,
  );
}

// ── Text extraction ───────────────────────────────────────

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
// - If OPENROUTER_API_KEY is set, all providers use OpenRouter (OpenAI-compatible API) instead of direct keys.

async function callAI(model, modelVariant, systemPrompt, documentText) {
  const clipped = (documentText || "").slice(0, MAX_MODEL_INPUT_CHARS);
  const fullPrompt = `${systemPrompt}\n\n---\n\nDocument Content:\n${clipped}`;

  if (openrouterClient) {
    return callOpenRouter(model, modelVariant, fullPrompt);
  }

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
        const geminiModel = geminiClient.getGenerativeModel({
          model: modelName,
        });
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
      `Gemini model unavailable. Last error: ${String(lastErr?.message || lastErr)}`,
    );
  }

  throw new Error("Unknown model: " + model);
}

async function* callAIStream(model, modelVariant, systemPrompt, documentText) {
  const clipped = (documentText || "").slice(0, MAX_MODEL_INPUT_CHARS);
  const fullPrompt = `${systemPrompt}\n\n---\n\nDocument Content:\n${clipped}`;

  if (openrouterClient) {
    yield* callOpenRouterStream(model, modelVariant, fullPrompt);
    return;
  }

  if (model === "chatgpt") {
    const openaiModel = modelVariant || process.env.OPENAI_MODEL || "gpt-4o";
    if (!openaiClient) throw new Error("OPENAI_API_KEY is not set");
    const stream = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 2000,
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk?.choices?.[0]?.delta?.content ?? "";
      if (text) yield text;
    }
    return;
  }

  if (model === "deepseek") {
    const deepseekModel = modelVariant || "deepseek-chat";
    if (!deepseekClient) throw new Error("DEEPSEEK_API_KEY is not set");
    const stream = await deepseekClient.chat.completions.create({
      model: deepseekModel,
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 2000,
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk?.choices?.[0]?.delta?.content ?? "";
      if (text) yield text;
    }
    return;
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
        const geminiModel = geminiClient.getGenerativeModel({
          model: modelName,
        });
        const stream = await geminiModel.generateContentStream(fullPrompt);
        for await (const chunk of stream.stream) {
          const text = chunk?.text?.() || "";
          if (text) yield text;
        }
        return;
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
      `Gemini model unavailable. Last error: ${String(lastErr?.message || lastErr)}`,
    );
  }

  throw new Error("Unknown model: " + model);
}

/**
 * @param {{
 *   documents: { id: number, name: string, url: string, type: string }[];
 *   isLecturer: boolean;
 *   effectiveModel: string;
 *   effectiveVariant: string | null;
 *   effectiveYearRange: import("@/lib/publishedYearFilter").PublishedYearRange;
 *   onStatus?: (phase: string) => void;
 * }} params
 */
async function prepareSummarizeContext({
  documents,
  isLecturer,
  effectiveModel,
  effectiveVariant,
  effectiveYearRange,
  onStatus,
}) {
  onStatus?.(SUMMARIZE_PHASE.EXTRACTING);

  const limit = createLimiter(EXTRACT_CONCURRENCY);
  const extracted = await Promise.all(
    documents.map((doc) =>
      limit(async () => {
        const text = await extractDocumentText(doc.url, doc.type);
        return { doc, text: text || "" };
      }),
    ),
  );

  let combinedText = "";
  for (const { doc, text } of extracted) {
    if (combinedText.length >= MAX_MODEL_INPUT_CHARS) break;
    combinedText += `\n\n=== ${doc.name} ===\n`;
    combinedText += text.slice(
      0,
      Math.max(0, MAX_MODEL_INPUT_CHARS - combinedText.length),
    );
  }

  let referenceCatalog = null;
  let referenceCatalogMeta = {
    uploadCount: documents.length,
    maxMarker: documents.length,
  };

  if (isLecturer) {
    onStatus?.(SUMMARIZE_PHASE.SEARCHING_REFERENCES);
    try {
      const papers = await fetchRelatedPapers(
        combinedText,
        documents,
        effectiveYearRange,
        {
          model: effectiveModel,
          modelVariant: effectiveVariant,
        },
      );
      const built = buildReferenceCatalog(documents, papers);
      referenceCatalog = built.catalog;
      referenceCatalogMeta = {
        uploadCount: built.uploadCount,
        maxMarker: built.maxMarker,
      };
    } catch (e) {
      console.warn("Academic search skipped:", e?.message);
      const built = buildReferenceCatalog(documents, []);
      referenceCatalog = built.catalog;
      referenceCatalogMeta = {
        uploadCount: built.uploadCount,
        maxMarker: built.maxMarker,
      };
    }
  }

  return { combinedText, referenceCatalog, referenceCatalogMeta };
}

function buildSummarizeSystemPrompt({
  normalizedRole,
  roleProfile,
  effectivePrompt,
  isLecturer,
  referenceCatalog,
  referenceCatalogMeta,
}) {
  const lecturerCitationBlock = isLecturer
    ? `\n\n${getLecturerSummaryCitationRules(referenceCatalogMeta.uploadCount)}`
    : "";
  const sourceListBlock =
    isLecturer && referenceCatalog?.length
      ? `\n\nNumbered sources (use ONLY these numbers for [n] citations):\n${referenceCatalog
          .map((r) => {
            if (r.kind === "upload")
              return `[${r.marker}] (uploaded) ${r.title}`;
            if (r.kind === "web") {
              const parts = [`[${r.marker}] (web) ${r.title}`];
              if (r.url) parts.push(`URL: ${r.url}`);
              return parts.join(" ");
            }
            const parts = [`[${r.marker}] (paper) ${r.title}`];
            if (r.authors) parts.push(`— ${r.authors}`);
            if (r.year) parts.push(`(${r.year})`);
            if (r.url) parts.push(`URL: ${r.url}`);
            return parts.join(" ");
          })
          .join("\n")}`
      : "";

  return `You are a document summarization assistant.
Audience mode: ${normalizedRole}.
${roleProfile.summaryInstructions.map((line) => `- ${line}`).join("\n")}${lecturerCitationBlock}${sourceListBlock}
${effectivePrompt ? `\nAdditional instructions: ${effectivePrompt}` : ""}
Format your response in clean markdown with clear sections.`;
}

// ── Route handler ─────────────────────────────────────────

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimited = await applyLlmRateLimit("summarize", user.id);
    if (rateLimited) return rateLimited;

    const {
      documentIds,
      summaryId,
      model,
      modelVariant,
      summarizeFor,
      prompt,
      stream: streamOutput = false,
      initOnly = false,
      publishedYearFrom: bodyPublishedYearFrom,
      publishedYearTo: bodyPublishedYearTo,
      publishedYearMode,
    } = await req.json();

    const requestYearRange = resolvePublishedYearRange({
      mode: publishedYearMode,
      publishedYearFrom: bodyPublishedYearFrom,
      publishedYearTo: bodyPublishedYearTo,
    });

    /** @type {{ id: number, name: string, url: string, type: string }[]} */
    let documents = [];
    /** @type {import("@prisma/client").Summary | null} */
    let existingSummary = null;

    // If a summary id is provided, we generate for that existing summary (used by /summary/[id] live streaming)
    if (summaryId != null) {
      const sid = Number(summaryId);
      if (!Number.isFinite(sid) || sid <= 0) {
        return NextResponse.json(
          { error: "Invalid summaryId" },
          { status: 400 },
        );
      }
      existingSummary = await prisma.summary.findFirst({
        where: { id: sid, userId: user.id },
        include: { documents: { include: { document: true } } },
      });
      if (!existingSummary) {
        return NextResponse.json(
          { error: "Summary not found" },
          { status: 404 },
        );
      }
      documents = (existingSummary.documents || [])
        .map((d) => d.document)
        .filter(Boolean)
        .map((d) => ({
          id: d.id,
          name: d.name,
          url: d.url,
          type: d.type,
          sourceUrl: d.sourceUrl || null,
        }));
      if (documents.length === 0) {
        return NextResponse.json(
          { error: "Summary has no linked documents" },
          { status: 400 },
        );
      }
    } else {
      if (!documentIds || documentIds.length === 0) {
        return NextResponse.json(
          { error: "No documents selected" },
          { status: 400 },
        );
      }

      // Fetch documents from DB
      documents = await prisma.document.findMany({
        where: { id: { in: documentIds }, userId: user.id },
        select: {
          id: true,
          name: true,
          url: true,
          type: true,
          sourceUrl: true,
        },
      });

      if (documents.length === 0) {
        return NextResponse.json(
          { error: "Documents not found" },
          { status: 404 },
        );
      }
    }

    // Create an empty "pending" summary row and redirect before generating (dashboard flow)
    if (initOnly) {
      if (existingSummary) {
        return NextResponse.json({
          success: true,
          summaryId: existingSummary.id,
        });
      }
      if (!model) {
        return NextResponse.json(
          { error: "Model is required" },
          { status: 400 },
        );
      }
      if (!summarizeFor) {
        return NextResponse.json(
          { error: "summarizeFor is required" },
          { status: 400 },
        );
      }
      const normalizedRole = normalizeSummarizeRole(summarizeFor);
      const title = documents[0].name.replace(/\.[^/.]+$/, "");
      const modelForDb = modelVariant ? `${model}:${modelVariant}` : model;
      const yearData =
        normalizedRole === "lecturer" && requestYearRange.active
          ? {
              publishedYearFrom: requestYearRange.from,
              publishedYearTo: requestYearRange.to,
            }
          : { publishedYearFrom: null, publishedYearTo: null };

      const created = await prisma.summary.create({
        data: {
          userId: user.id,
          title,
          model: modelForDb,
          summarizeFor: normalizedRole,
          prompt: prompt || null,
          ...yearData,
          output: "",
          documents: {
            create: documents.map((doc) => ({ documentId: doc.id })),
          },
        },
        select: { id: true },
      });
      return NextResponse.json({ success: true, summaryId: created.id });
    }

    // Resolve prompt/model settings from either request body or existing summary row
    const normalizedRole = normalizeSummarizeRole(
      existingSummary?.summarizeFor ?? summarizeFor,
    );
    const roleProfile = getRoleProfile(normalizedRole);

    const effectivePrompt =
      typeof existingSummary?.prompt === "string"
        ? existingSummary.prompt
        : prompt || "";

    /** provider key like "chatgpt" / "deepseek" / "gemini" */
    let effectiveModel = model;
    /** exact model id (optional) */
    let effectiveVariant = modelVariant || null;
    if (existingSummary?.model) {
      const stored = String(existingSummary.model);
      const i = stored.indexOf(":");
      effectiveModel = i === -1 ? stored : stored.slice(0, i);
      effectiveVariant = i === -1 ? null : stored.slice(i + 1) || null;
    }

    const isLecturer = normalizedRole === "lecturer";

    const storedYearRange = resolvePublishedYearRange({
      publishedYearFrom: existingSummary?.publishedYearFrom,
      publishedYearTo: existingSummary?.publishedYearTo,
      mode:
        existingSummary?.publishedYearFrom != null ||
        existingSummary?.publishedYearTo != null
          ? "custom"
          : "all",
    });
    const effectiveYearRange =
      requestYearRange.active || !existingSummary
        ? requestYearRange
        : storedYearRange;

    const makeFinalizers = (referenceCatalog, referenceCatalogMeta) => {
      const finalizeLecturerOutput = async (raw, summaryIdForRefs) => {
        let out = String(raw || "").trim();
        if (referenceCatalogMeta.maxMarker > 0) {
          out = clampInvalidCitations(out, referenceCatalogMeta.maxMarker);
        }
        const { markdown, citedCatalog, anchorMap } =
          finalizeLecturerReferences(out, referenceCatalog);
        if (summaryIdForRefs) {
          if (citedCatalog.length > 0) {
            await persistSummaryReferences(
              prisma,
              summaryIdForRefs,
              citedCatalog,
              anchorMap,
            );
          } else {
            await prisma.summaryReference.deleteMany({
              where: { summaryId: summaryIdForRefs },
            });
          }
        }
        return markdown;
      };

      const finalizeOutput = (raw) => {
        if (!isLecturer) return String(raw || "").trim();
        let out = clampInvalidCitations(raw, referenceCatalogMeta.maxMarker);
        return finalizeLecturerReferences(out, referenceCatalog).markdown;
      };

      return { finalizeLecturerOutput, finalizeOutput };
    };

    if (streamOutput) {
      const encoder = new TextEncoder();
      const sendEvent = (controller, event, payload) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
          ),
        );
      };

      const body = new ReadableStream({
        async start(controller) {
          try {
            const { combinedText, referenceCatalog, referenceCatalogMeta } =
              await prepareSummarizeContext({
                documents,
                isLecturer,
                effectiveModel,
                effectiveVariant,
                effectiveYearRange,
                onStatus: (phase) => sendEvent(controller, "status", { phase }),
              });

            sendEvent(controller, "status", {
              phase: SUMMARIZE_PHASE.WRITING_SUMMARY,
            });

            const systemPrompt = buildSummarizeSystemPrompt({
              normalizedRole,
              roleProfile,
              effectivePrompt,
              isLecturer,
              referenceCatalog,
              referenceCatalogMeta,
            });

            const { finalizeLecturerOutput, finalizeOutput } = makeFinalizers(
              referenceCatalog,
              referenceCatalogMeta,
            );

            sendEvent(controller, "meta", { ok: true });
            let output = "";
            let lastPersistAt = 0;
            let lastPersistLen = 0;

            for await (const chunk of callAIStream(
              effectiveModel,
              effectiveVariant,
              systemPrompt,
              combinedText,
            )) {
              output += chunk;
              sendEvent(controller, "chunk", { text: chunk });

              if (existingSummary) {
                const now = Date.now();
                if (
                  now - lastPersistAt > 1200 &&
                  output.length - lastPersistLen > 200
                ) {
                  lastPersistAt = now;
                  lastPersistLen = output.length;
                  await prisma.summary.updateMany({
                    where: { id: existingSummary.id, userId: user.id },
                    data: { output },
                  });
                }
              }
            }

            let summaryIdForRefs = existingSummary?.id;
            if (!summaryIdForRefs) {
              const title = documents[0].name.replace(/\.[^/.]+$/, "");
              const modelForDb = effectiveVariant
                ? `${effectiveModel}:${effectiveVariant}`
                : effectiveModel;
              const pending = await prisma.summary.create({
                data: {
                  userId: user.id,
                  title,
                  model: modelForDb,
                  summarizeFor: normalizedRole,
                  prompt: effectivePrompt || null,
                  output: "",
                  documents: {
                    create: documents.map((doc) => ({ documentId: doc.id })),
                  },
                },
                select: { id: true },
              });
              summaryIdForRefs = pending.id;
            }

            const finalOutput = isLecturer
              ? await finalizeLecturerOutput(output, summaryIdForRefs)
              : finalizeOutput(output);
            if (finalOutput.length > output.length) {
              const suffix = finalOutput.slice(output.length);
              sendEvent(controller, "chunk", { text: suffix });
            }

            await prisma.summary.updateMany({
              where: { id: summaryIdForRefs, userId: user.id },
              data: { output: finalOutput },
            });
            sendEvent(controller, "done", {
              summaryId: summaryIdForRefs,
              referencesReady: isLecturer,
            });
            controller.close();
          } catch (err) {
            console.error("Summarize stream error:", err);
            sendEvent(controller, "error", {
              error: "Summarization failed: " + String(err?.message || err),
            });
            controller.close();
          }
        },
      });

      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const { combinedText, referenceCatalog, referenceCatalogMeta } =
      await prepareSummarizeContext({
        documents,
        isLecturer,
        effectiveModel,
        effectiveVariant,
        effectiveYearRange,
      });

    const systemPrompt = buildSummarizeSystemPrompt({
      normalizedRole,
      roleProfile,
      effectivePrompt,
      isLecturer,
      referenceCatalog,
      referenceCatalogMeta,
    });

    const { finalizeLecturerOutput, finalizeOutput } = makeFinalizers(
      referenceCatalog,
      referenceCatalogMeta,
    );

    const rawOutput = await callAI(
      effectiveModel,
      effectiveVariant,
      systemPrompt,
      combinedText,
    );

    if (existingSummary) {
      const output = isLecturer
        ? await finalizeLecturerOutput(rawOutput, existingSummary.id)
        : finalizeOutput(rawOutput);
      await prisma.summary.updateMany({
        where: { id: existingSummary.id, userId: user.id },
        data: { output },
      });
      return NextResponse.json({
        success: true,
        summaryId: existingSummary.id,
      });
    }

    const title = documents[0].name.replace(/\.[^/.]+$/, "");
    const modelForDb = effectiveVariant
      ? `${effectiveModel}:${effectiveVariant}`
      : effectiveModel;
    const summary = await prisma.summary.create({
      data: {
        userId: user.id,
        title,
        model: modelForDb,
        summarizeFor: normalizedRole,
        prompt: effectivePrompt || null,
        output: "",
        documents: {
          create: documents.map((doc) => ({ documentId: doc.id })),
        },
      },
      select: { id: true },
    });

    const output = isLecturer
      ? await finalizeLecturerOutput(rawOutput, summary.id)
      : finalizeOutput(rawOutput);

    await prisma.summary.updateMany({
      where: { id: summary.id, userId: user.id },
      data: { output },
    });

    return NextResponse.json({ success: true, summaryId: summary.id });
  } catch (err) {
    console.error("Summarize error:", err);
    return NextResponse.json(
      { error: "Summarization failed: " + err.message },
      { status: 500 },
    );
  }
}
