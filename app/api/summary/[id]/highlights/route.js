import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const MAX_QUOTE = 2000;

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_HL_COLOR = "#fef08a";

function normalizeHighlightColor(raw) {
  const s = String(raw ?? "").trim();
  if (HEX_COLOR.test(s)) return s.toLowerCase();
  return DEFAULT_HL_COLOR;
}

async function getUserFromSession() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user;
}

async function getSummaryIdFromParams(params) {
  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) {
    throw new Error("Invalid id");
  }
  return id;
}

export async function GET(_req, ctx) {
  try {
    const user = await getUserFromSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const summaryId = await getSummaryIdFromParams(ctx.params);

    const owned = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await prisma.summaryHighlight.findMany({
      where: { summaryId },
      orderBy: { createdAt: "desc" },
      select: { id: true, quote: true, color: true, createdAt: true },
    });

    return NextResponse.json({ highlights: rows });
  } catch (err) {
    const msg = err?.message || "";
    if (msg === "Invalid id") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to load highlights" }, { status: 500 });
  }
}

export async function POST(req, ctx) {
  try {
    const user = await getUserFromSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const summaryId = await getSummaryIdFromParams(ctx.params);

    const owned = await prisma.summary.findFirst({
      where: { id: summaryId, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const quote = String(body?.quote ?? "")
      .trim()
      .slice(0, MAX_QUOTE);
    if (!quote) {
      return NextResponse.json({ error: "Quote is required" }, { status: 400 });
    }

    const color = normalizeHighlightColor(body?.color);

    const created = await prisma.summaryHighlight.create({
      data: {
        userId: user.id,
        summaryId,
        quote,
        color,
      },
      select: { id: true, quote: true, color: true, createdAt: true },
    });

    return NextResponse.json({ highlight: created });
  } catch (err) {
    const msg = err?.message || "";
    if (msg === "Invalid id") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to save highlight" }, { status: 500 });
  }
}
