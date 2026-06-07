import { NextResponse } from "next/server";
import { getLlmProvidersConfig } from "@/lib/llmProviders";

/** Public: which LLM providers are configured on this deployment. */
export async function GET() {
  return NextResponse.json(getLlmProvidersConfig());
}
