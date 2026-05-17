import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/apiHandler";

// PUBLIC ROUTE — no auth required (deprecated password reset path)
/**
 * Legacy/alternate path. New password is set via POST /api/reset-password (email, token, password).
 */
export const POST = apiHandler(async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use POST /api/reset-password with email, token, and password.",
    },
    { status: 410 },
  );
});
