import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { signDocumentViewToken } from "@/lib/documentViewToken";

/** Mint a short-lived token so /view?t=… works without cookies (e.g. Office Online viewer fetch). */
export async function GET(_req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const documentId = parseInt(String(params?.id ?? ""), 10);
    if (Number.isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document id" },
        { status: 400 },
      );
    }

    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId: user.id },
      select: { id: true },
    });
    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    let token;
    try {
      token = signDocumentViewToken(documentId, user.id);
    } catch (e) {
      console.error("view-token sign:", e);
      return NextResponse.json(
        {
          error: "Server missing DOCUMENT_VIEW_TOKEN_SECRET or NEXTAUTH_SECRET",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ token });
  } catch (err) {
    console.error("view-token:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
