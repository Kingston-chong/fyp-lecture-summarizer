import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req) {
  const { email, token, password } = await req.json();

  const record = await prisma.passwordReset.findUnique({ where: { email } });

  if (!record || record.token !== token) {
    return NextResponse.json(
      { error: "Invalid or expired reset token." },
      { status: 400 }
    );
  }
  if (new Date() > record.tokenExpiry) {
    return NextResponse.json(
      { error: "Reset session expired. Please start again." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  await prisma.passwordReset.update({
    where: { email },
    data: { used: true, token: null },
  });

  return NextResponse.json({ success: true });
}