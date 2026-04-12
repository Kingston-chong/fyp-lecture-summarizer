// app/api/upload/route.js
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";

// Generates a new unique name if duplicate exists
// lu1-tutorial.pdf → lu1-tutorial (1).pdf → lu1-tutorial (2).pdf
function generateRenamedFile(originalName, existingNames) {
  const dotIndex = originalName.lastIndexOf(".");
  const hasExt = dotIndex !== -1;
  const base = hasExt ? originalName.slice(0, dotIndex) : originalName;
  const ext  = hasExt ? originalName.slice(dotIndex) : "";   // includes the dot

  let counter = 1;
  let newName = `${base} (${counter})${ext}`;

  // Keep incrementing until we find a name that doesn't exist
  while (existingNames.has(newName)) {
    counter++;
    newName = `${base} (${counter})${ext}`;
  }

  return newName;
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const files     = formData.getAll("files");
    // "rename" field is a JSON array of booleans — true means rename this file
    const renameFlags = JSON.parse(formData.get("renameFlags") || "[]");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Fetch all existing document names for this user (for duplicate checking)
    const existingDocs = await prisma.document.findMany({
      where: { userId: user.id },
      select: { name: true },
    });
    const existingNames = new Set(existingDocs.map(d => d.name));

    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file       = files[i];
      const shouldRename = renameFlags[i] === true;

      let finalName = file.name;

      if (shouldRename && existingNames.has(file.name)) {
        finalName = generateRenamedFile(file.name, existingNames);
      }

      // Add to set so subsequent files in the same batch don't collide
      existingNames.add(finalName);

      const ext = finalName.split(".").pop().toUpperCase();

      // Upload to Vercel Blob
      const blob = await put(
        `uploads/${user.id}/${Date.now()}-${finalName}`,
        file,
        { access: "private" }
      );

      // Save to database with the (possibly renamed) name
      const doc = await prisma.document.create({
        data: {
          userId: user.id,
          name:   finalName,
          url:    blob.url,
          type:   ext,
          size:   file.size,
        },
      });

      uploaded.push({ ...doc, originalName: file.name, finalName });
    }

    return NextResponse.json({ success: true, documents: uploaded });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed: " + err.message }, { status: 500 });
  }
}
