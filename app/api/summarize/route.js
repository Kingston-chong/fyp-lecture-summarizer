// app/api/summarize/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import {
  finalizeLecturerReferences,
  persistSummaryReferences,
} from "@/lib/referenceUtils";
import {
  getRoleProfile,
  normalizeSummarizeRole,
} from "@/lib/roleProfiles";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { resolvePublishedYearRange } from "@/lib/publishedYearFilter";
import { SUMMARIZE_PHASE } from "@/lib/summarizeProgress";
import { resolveSummarizeOutputLength } from "@/lib/summarizeOutputLength";
import {
  buildSummarizeSystemPrompt,
  prepareSummarizeContextFromUrls,
  callAIStreamWithFallback,
  callAIWithFallback,
  providerDisplayLabel,
} from "@/lib/summarizeEngine";

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
      outputLength,
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
          outputLength: resolveSummarizeOutputLength(outputLength).id,
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

    const lengthOption = resolveSummarizeOutputLength(
      existingSummary?.outputLength ?? outputLength,
    );

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
        const { markdown, citedCatalog, anchorMap } = finalizeLecturerReferences(
          String(raw || "").trim(),
          referenceCatalog,
        );
        const out = markdown;
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
        return finalizeLecturerReferences(
          String(raw || "").trim(),
          referenceCatalog,
        ).markdown;
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
              await prepareSummarizeContextFromUrls({
                documents,
                isLecturer,
                effectiveModel,
                effectiveVariant,
                effectiveYearRange,
                onStatus: (payload) =>
                  sendEvent(controller, "status", payload),
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
              outputLength: lengthOption.id,
            });

            const { finalizeLecturerOutput, finalizeOutput } = makeFinalizers(
              referenceCatalog,
              referenceCatalogMeta,
            );

            sendEvent(controller, "meta", { ok: true });
            let output = "";
            let lastPersistAt = 0;
            let lastPersistLen = 0;

            for await (const chunk of callAIStreamWithFallback(
              effectiveModel,
              effectiveVariant,
              systemPrompt,
              combinedText,
              {
                maxTokens: lengthOption.maxTokens,
                onProviderSwitch: ({ from, to }) => {
                  sendEvent(controller, "status", {
                    phase: SUMMARIZE_PHASE.WRITING_SUMMARY,
                    step: "model_fallback",
                    fromProvider: from,
                    toProvider: to,
                    message: `${providerDisplayLabel(from)} limit reached — switching to ${providerDisplayLabel(to)}…`,
                  });
                },
              },
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
                  outputLength: lengthOption.id,
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
              data: { output: finalOutput, outputLength: lengthOption.id },
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
      await prepareSummarizeContextFromUrls({
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
      outputLength: lengthOption.id,
    });

    const { finalizeLecturerOutput, finalizeOutput } = makeFinalizers(
      referenceCatalog,
      referenceCatalogMeta,
    );

    const rawOutput = await callAIWithFallback(
      effectiveModel,
      effectiveVariant,
      systemPrompt,
      combinedText,
      { maxTokens: lengthOption.maxTokens },
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
        outputLength: lengthOption.id,
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
      data: { output, outputLength: lengthOption.id },
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
