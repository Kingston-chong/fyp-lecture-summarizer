import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { parsePptxBufferToSlides } from "@/lib/improvePptParse";

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const name = file.name || "upload.pptx";
    if (!/\.pptx$/i.test(name)) {
      return NextResponse.json(
        {
          error:
            "Only .pptx files are supported. Convert .ppt to .pptx in PowerPoint first.",
        },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const slides = await parsePptxBufferToSlides(buf);

    return NextResponse.json({ slides });
  } catch (err) {
    console.error("improve-ppt parse:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
