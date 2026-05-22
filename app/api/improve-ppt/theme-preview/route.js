import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";

/**
 * GET /api/improve-ppt/theme-preview?themeId=<id>
 *
 * 2slides documents only theme search (id, name, description, tags, themeURL).
 * There is no public preview-image endpoint; template pages are client-rendered
 * without og:image. The template picker uses placeholders + "View ↗" instead.
 */

export async function GET() {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Theme thumbnails are not available from 2slides. Open the template page via themeURL.",
    },
    { status: 404 },
  );
}
