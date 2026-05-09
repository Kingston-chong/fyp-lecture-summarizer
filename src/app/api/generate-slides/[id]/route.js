import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { extractPptxUrlFromAlaiGenerationJson } from "@/lib/alaiSlidePptx";

export async function GET(req, context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await Promise.resolve(context?.params);
    const id = resolved?.id;
    if (!id) {
      return NextResponse.json({ error: "Generation ID is required" }, { status: 400 });
    }

    if (!process.env.ALAI_API_KEY) {
      return NextResponse.json({ error: "ALAI_API_KEY is not configured on the server." }, { status: 500 });
    }

    // Proxy the polling request to Alai API
    const res = await fetch(`https://slides-api.getalai.com/api/v1/generations/${id}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.ALAI_API_KEY}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Alai API Polling Error:", errData);
        return NextResponse.json(
            { error: errData.error || errData.message || "Failed to check generation status" }, 
            { status: res.status }
        );
    }

    const data = await res.json().catch(() => ({}));

    // Alai statuses: pending | in_progress | completed | failed
    const status = String(data?.status || "in_progress").toLowerCase();

    if (status === "failed") {
      return NextResponse.json(
        { status: "failed", error: data?.error || "Slide generation failed at Alai API." },
        { status: 500 },
      );
    }

    if (status === "completed") {
      // Alai returns export URLs under data.formats.* (shape may vary by API version)
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
        const downloadEndpoint = `${base.origin}/api/generate-slides/${encodeURIComponent(id)}/download`;
        return NextResponse.json({
          status: "completed",
          // Prefer our proxy download endpoint (sets Content-Disposition correctly)
          download_url: downloadEndpoint,
          preview_url: previewUrl,
          // Keep the upstream signed URL available for debugging
          remote_download_url: pptUrl,
        });
      }

      // Completed but export not ready/wasn't requested yet.
      return NextResponse.json({
        status: "completed",
        progress: 100,
        error: "Generation completed but PPT export URL is not available yet.",
      });
    }

    // If still in progress, return the current status
    return NextResponse.json({
      status,
      progress: data?.progress || 0,
    });

  } catch (err) {
    console.error("generate-slides proxy GET:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
