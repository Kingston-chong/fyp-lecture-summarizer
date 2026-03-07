// app/api/upload/route.js
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    const formData = await req.formData();
    const files = formData.getAll("files"); // supports multiple files

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploaded = [];

    for (const file of files) {
      const ext = file.name.split(".").pop().toUpperCase();

      // Upload to Vercel Blob
      const blob = await put(
        `uploads/${user.id}/${Date.now()}-${file.name}`,
        file,
        { access: "private" }
      );

      // Save to database
      const doc = await prisma.document.create({
        data: {
          userId: user.id,
          name: file.name,
          url: blob.url,
          type: ext,
          size: file.size,
        },
      });

      uploaded.push(doc);
    }

    return NextResponse.json({ success: true, documents: uploaded });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}