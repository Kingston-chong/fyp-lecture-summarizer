import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { extractPptxUrlFromAlaiGenerationJson } from "@/lib/alaiSlidePptx";

export async function GET(req, context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resolved = await Promise.resolve(context?.params);
  const id = resolved?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Generation ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ALAI_API_KEY) {
    return new Response(JSON.stringify({ error: "ALAI_API_KEY is not configured on the server." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Poll Alai once to get a fresh signed URL (valid ~24h).
  const statusRes = await fetch(`https://slides-api.getalai.com/api/v1/generations/${id}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${process.env.ALAI_API_KEY}` },
    cache: "no-store",
  });

  const statusData = await statusRes.json().catch(() => ({}));
  if (!statusRes.ok) {
    return new Response(JSON.stringify({ error: statusData?.error || statusData?.message || "Failed to fetch generation status" }), {
      status: statusRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const genStatus = String(statusData?.status || "").toLowerCase();
  if (genStatus !== "completed") {
    return new Response(JSON.stringify({ error: `Not ready (status: ${genStatus || "unknown"})` }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pptUrl = extractPptxUrlFromAlaiGenerationJson(statusData);

  if (!pptUrl) {
    return new Response(JSON.stringify({ error: "PPT export URL not available." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Download the actual PPTX server-side and stream it to the browser.
  const fileRes = await fetch(pptUrl, { cache: "no-store" });
  if (!fileRes.ok) {
    return new Response(JSON.stringify({ error: "Failed to download PPTX from upstream." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const title = (url.searchParams.get("title") || "presentation").trim();
  const safeBase = title.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "presentation";
  const filename = `${safeBase}.pptx`;

  const headers = new Headers();
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  const len = fileRes.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new Response(fileRes.body, { status: 200, headers });
}

