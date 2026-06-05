import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { getClientIp } from "@/lib/rateLimit";
import { applyLlmRateLimit } from "@/lib/llmRateLimit";
import { extractWebSource } from "@/lib/webPageExtract";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const user = await getRequestUser();
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url || "").trim();

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    if (!user) {
      const ip = getClientIp(req);
      const rateLimited = await applyLlmRateLimit(
        "sources-webpage-guest",
        `ip:${ip}`,
      );
      if (rateLimited) return rateLimited;
    }

    const extracted = await extractWebSource(url);

    if (extracted.method === "file" && extracted.file) {
      return NextResponse.json({
        sourceUrl: extracted.sourceUrl,
        title: extracted.title,
        method: "file",
        file: {
          name: extracted.file.name,
          type: extracted.file.type,
          size: extracted.file.size,
          data: extracted.file.buffer.toString("base64"),
        },
      });
    }

    return NextResponse.json({
      sourceUrl: extracted.sourceUrl,
      title: extracted.title,
      text: extracted.text,
      method: extracted.method,
      charCount: extracted.text.length,
    });
  } catch (err) {
    console.error("sources/webpage:", err);
    const message = err?.message || "Could not extract webpage";
    const status =
      message.includes("too large") || message.includes("Too large")
        ? 413
        : message.includes("valid http") ||
            message.includes("Enter a") ||
            message.includes("Cannot")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
