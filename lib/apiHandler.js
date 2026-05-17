import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Wraps a Next.js route handler with a top-level try/catch.
 * @param {(req: Request, ctx?: unknown) => Promise<Response>} handler
 */
export function apiHandler(handler) {
  return async function (req, ctx) {
    try {
      return await handler(req, ctx);
    } catch (err) {
      logger.error("apiHandler", err?.message || "Internal server error", {
        url: req.url,
        method: req.method,
      });
      const message = err?.message || "Internal server error";
      const status = err?.status || 500;
      return NextResponse.json({ error: message }, { status });
    }
  };
}
