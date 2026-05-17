import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi";
import { apiHandler } from "@/lib/apiHandler";

export const GET = apiHandler(async function GET() {
  return NextResponse.json(openApiSpec);
});
