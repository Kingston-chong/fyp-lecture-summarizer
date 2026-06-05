import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/rateLimit";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { parseGuestSummarizeFormData } from "@/lib/guestUpload";
import { resolvePublishedYearRange } from "@/lib/publishedYearFilter";
import { SUMMARIZE_PHASE } from "@/lib/summarizeProgress";
import {
  buildSummarizeSystemPrompt,
  callAIStream,
  finalizeSummarizeOutput,
  getRoleProfile,
  normalizeSummarizeRole,
  prepareSummarizeContextFromBuffers,
} from "@/lib/summarizeEngine";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rateLimited = await applyLlmRateLimit("summarize-guest", `ip:${ip}`);
    if (rateLimited) return rateLimited;

    const formData = await req.formData();
    const parsed = await parseGuestSummarizeFormData(formData);

    const normalizedRole = normalizeSummarizeRole(parsed.summarizeFor);
    const roleProfile = getRoleProfile(normalizedRole);
    const isLecturer = normalizedRole === "lecturer";
    const effectiveYearRange = resolvePublishedYearRange({
      mode: parsed.publishedYearMode,
      publishedYearFrom: parsed.publishedYearFrom,
      publishedYearTo: parsed.publishedYearTo,
    });

    const encoder = new TextEncoder();
    const sendEvent = (controller, event, payload) => {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
      );
    };

    const body = new ReadableStream({
      async start(controller) {
        try {
          const { combinedText, referenceCatalog, referenceCatalogMeta } =
            await prepareSummarizeContextFromBuffers({
              documents: parsed.documents,
              isLecturer,
              effectiveModel: parsed.model,
              effectiveVariant: parsed.modelVariant,
              effectiveYearRange,
              onStatus: (phase) => sendEvent(controller, "status", { phase }),
            });

          sendEvent(controller, "status", {
            phase: SUMMARIZE_PHASE.WRITING_SUMMARY,
          });

          const systemPrompt = buildSummarizeSystemPrompt({
            normalizedRole,
            roleProfile,
            effectivePrompt: parsed.prompt,
            isLecturer,
            referenceCatalog,
            referenceCatalogMeta,
          });

          sendEvent(controller, "meta", {
            ok: true,
            title: parsed.documents[0].name.replace(/\.[^/.]+$/, ""),
            summarizeFor: normalizedRole,
            model: parsed.modelVariant
              ? `${parsed.model}:${parsed.modelVariant}`
              : parsed.model,
          });

          let output = "";
          for await (const chunk of callAIStream(
            parsed.model,
            parsed.modelVariant,
            systemPrompt,
            combinedText,
          )) {
            output += chunk;
            sendEvent(controller, "chunk", { text: chunk });
          }

          const finalOutput = finalizeSummarizeOutput(output, {
            isLecturer,
            referenceCatalog,
            referenceCatalogMeta,
          });

          if (finalOutput.length > output.length) {
            const suffix = finalOutput.slice(output.length);
            sendEvent(controller, "chunk", { text: suffix });
          }

          sendEvent(controller, "done", {
            output: finalOutput,
            referencesReady: isLecturer,
          });
          controller.close();
        } catch (err) {
          console.error("Guest summarize stream error:", err);
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
  } catch (err) {
    console.error("Guest summarize error:", err);
    const message = String(err?.message || err);
    const status =
      message.includes("upload") || message.includes("file") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
