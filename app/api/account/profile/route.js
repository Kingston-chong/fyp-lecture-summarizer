import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/authUtils";
import {
  authProviderFromPasswordHash,
  validateUsername,
} from "@/lib/accountProfile";

async function requireSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { email: normalizeEmail(session.user.email) };
}

function profilePayload(user) {
  return {
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    authProvider: authProviderFromPasswordHash(user.passwordHash),
  };
}

/** GET /api/account/profile */
export async function GET() {
  const auth = await requireSessionUser();
  if (auth.error) return auth.error;

  const user = await prisma.user.findUnique({
    where: { email: auth.email },
    select: {
      username: true,
      email: true,
      role: true,
      createdAt: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ profile: profilePayload(user) });
}

/** PATCH /api/account/profile — update username */
export async function PATCH(req) {
  const auth = await requireSessionUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const validated = validateUsername(body?.username ?? body?.name);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: auth.email },
    select: { id: true, username: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (validated.username === user.username) {
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        username: true,
        email: true,
        role: true,
        createdAt: true,
        passwordHash: true,
      },
    });
    return NextResponse.json({ ok: true, profile: profilePayload(full) });
  }

  const taken = await prisma.user.findUnique({
    where: { username: validated.username },
    select: { id: true },
  });
  if (taken && taken.id !== user.id) {
    return NextResponse.json(
      { error: "That username is already taken." },
      { status: 409 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { username: validated.username },
    select: {
      username: true,
      email: true,
      role: true,
      createdAt: true,
      passwordHash: true,
    },
  });

  return NextResponse.json({ ok: true, profile: profilePayload(updated) });
}
