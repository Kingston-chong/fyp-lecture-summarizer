import { NextResponse } from "next/server";

/**
 * Legacy/alternate path. New password is set via POST /api/reset-password (email, token, password).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use POST /api/reset-password with email, token, and password.",
    },
    { status: 410 },
  );
}
