import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { extractPptxUrlFromAlaiGenerationJson } from "@/lib/alaiSlidePptx";
import { pollTwoSlidesGeneration } from "@/lib/twoSlidesGenerate";
import { logger } from "@/lib/logger";

export async function GET(req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await Promise.resolve(context?.params);
    const id = resolved?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Generation ID is required" },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const provider = String(
      url.searchParams.get("provider") || "alai",
    ).toLowerCase();

    if (provider === "2slides") {
      const result = await pollTwoSlidesGeneration(id);

      if (result.status === "failed") {
        return NextResponse.json(
          {
            status: "failed",
            error: result.error || "2slides generation failed.",
          },
          { status: 500 },
        );
      }

      if (result.status === "completed" && result.downloadUrl) {
        const base = new URL(req.url);
        const downloadEndpoint = `${base.origin}/api/generate-slides/${encodeURIComponent(id)}/download?provider=2slides`;
        return NextResponse.json({
          status: "completed",
          download_url: downloadEndpoint,
          remote_download_url: result.downloadUrl,
          preview_url: null,
        });
      }

      return NextResponse.json({ status: result.status, progress: 0 });
    }

    if (!process.env.ALAI_API_KEY) {
      return NextResponse.json(
        { error: "ALAI_API_KEY is not configured on the server." },
        { status: 500 },
      );
    }

    const res = await fetch(
      `https://slides-api.getalai.com/api/v1/generations/${id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.ALAI_API_KEY}`,
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            errData.error ||
            errData.message ||
            "Failed to check generation status",
        },
        { status: res.status },
      );
    }

    const data = await res.json().catch(() => ({}));
    const status = String(data?.status || "in_progress").toLowerCase();

    if (status === "failed") {
      return NextResponse.json(
        {
          status: "failed",
          error: data?.error || "Slide generation failed at Alai API.",
        },
        { status: 500 },
      );
    }

    if (status === "completed") {
      const formats =
        data?.formats && typeof data.formats === "object" ? data.formats : null;
      const pptUrl = extractPptxUrlFromAlaiGenerationJson(data);
      const previewUrl =
        formats?.link?.url ||
        formats?.viewer?.url ||
        formats?.pdf?.url ||
        data?.preview_url ||
        data?.previewUrl ||
        data?.link_url ||
        data?.linkUrl ||
        data?.viewer_url ||
        null;

      if (pptUrl) {
        const base = new URL(req.url);
        const downloadEndpoint = `${base.origin}/api/generate-slides/${encodeURIComponent(id)}/download?provider=alai`;
        return NextResponse.json({
          status: "completed",
          download_url: downloadEndpoint,
          preview_url: previewUrl,
          remote_download_url: pptUrl,
        });
      }

      return NextResponse.json({
        status: "completed",
        progress: 100,
        error: "Generation completed but PPT export URL is not available yet.",
      });
    }

    return NextResponse.json({
      status,
      progress: data?.progress || 0,
    });
  } catch (err) {
    logger.error("generate-slides", err?.message || "GET poll failed", {
      stack: err?.stack,
    });
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
