import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { MAX_FILE_BYTES, assertPathnameForUser } from "@/lib/documentUpload";

export async function POST(request) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        assertPathnameForUser(pathname, user.id);
        return {
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Upload token failed" },
      { status: 400 },
    );
  }
}
