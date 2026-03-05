// app/api/upload/route.js
import { put } from "@vercel/blob";

export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get("file");

  const blob = await put(`uploads/${userId}/${file.name}`, file, {
    access: "private",
  });

  // Save blob.url to your database
  await prisma.document.create({
    data: { userId, name: file.name, url: blob.url, type: file.type }
  });

  return Response.json({ url: blob.url });
}