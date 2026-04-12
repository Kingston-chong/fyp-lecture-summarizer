import { fetchUnsplashImageUrl } from "@/lib/unsplashStock";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
    }

    const url = await fetchUnsplashImageUrl(query);
    
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error testing Unsplash:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
