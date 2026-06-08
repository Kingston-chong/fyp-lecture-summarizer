import { getRequestUser } from "@/lib/apiAuth";
import { extractPptxUrlFromAlaiGenerationJson } from "@/lib/alaiSlidePptx";
import { pollTwoSlidesGeneration } from "@/lib/twoSlidesGenerate";
import { alaiFetch, getAlaiApiKeys } from "@/lib/alaiClient";
import { getTwoSlidesApiKeys } from "@/lib/twoSlidesClient";
import { apiHandler } from "@/lib/apiHandler";

/** @param {string} url */
function isAllowedUpstreamPptUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".getalai.com") ||
      host.includes("alai") ||
      host.endsWith(".amazonaws.com") ||
      host.endsWith(".cloudfront.net") ||
      host.endsWith(".blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

function pptxResponse(fileRes, titleParam) {
  const title = (titleParam || "presentation").trim();
  const safeBase =
    title
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "presentation";
  const filename = `${safeBase}.pptx`;

  const headers = new Headers();
  headers.set(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);

  const len = fileRes.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new Response(fileRes.body, { status: 200, headers });
}

export const GET = apiHandler(async function GET(req, context) {
  const user = await getRequestUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resolved = await Promise.resolve(context?.params);
  const id = resolved?.id;
  if (!id) {
    return new Response(
      JSON.stringify({ error: "Generation ID is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const url = new URL(req.url);
  const provider = String(
    url.searchParams.get("provider") || "alai",
  ).toLowerCase();
  const titleParam = url.searchParams.get("title") || "presentation";

  if (provider === "2slides") {
    if (!getTwoSlidesApiKeys().length) {
      return new Response(
        JSON.stringify({ error: "TWOSLIDES_API_KEY is not configured." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Always re-poll; 2slides presigned download URLs expire after ~1 hour.
    const result = await pollTwoSlidesGeneration(id);

    if (result.status !== "completed" || !result.downloadUrl) {
      return new Response(
        JSON.stringify({ error: `Not ready (status: ${result.status})` }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const fileRes = await fetch(result.downloadUrl, { cache: "no-store" });
    if (!fileRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download PPTX from 2slides." }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return pptxResponse(fileRes, titleParam);
  }

  if (!getAlaiApiKeys().length) {
    return new Response(
      JSON.stringify({
        error: "ALAI_API_KEY is not configured on the server.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { res: statusRes, data: statusData } = await alaiFetch(
    `/generations/${id}`,
    { method: "GET" },
  );
  if (!statusRes.ok) {
    return new Response(
      JSON.stringify({
        error:
          statusData?.error ||
          statusData?.message ||
          "Failed to fetch generation status",
      }),
      {
        status: statusRes.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const genStatus = String(statusData?.status || "").toLowerCase();
  if (genStatus !== "completed") {
    return new Response(
      JSON.stringify({
        error: `Not ready (status: ${genStatus || "unknown"})`,
      }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const pptUrl = extractPptxUrlFromAlaiGenerationJson(statusData);

  if (!pptUrl) {
    return new Response(
      JSON.stringify({ error: "PPT export URL not available." }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const proxyOnly = url.searchParams.get("mode") === "proxy";
  if (!proxyOnly && isAllowedUpstreamPptUrl(pptUrl)) {
    return Response.redirect(pptUrl, 307);
  }

  const fileRes = await fetch(pptUrl, { cache: "no-store" });
  if (!fileRes.ok) {
    return new Response(
      JSON.stringify({ error: "Failed to download PPTX from upstream." }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return pptxResponse(fileRes, titleParam);
});
