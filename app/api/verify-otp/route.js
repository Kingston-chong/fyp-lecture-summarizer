import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req) {
  const { email, otp } = await req.json();

  const record = await prisma.passwordReset.findUnique({ where: { email } });

  if (!record) {
    return NextResponse.json(
      { error: "No OTP request found for this email." },
      { status: 400 }
    );
  }
  if (record.used) {
    return NextResponse.json(
      { error: "This OTP has already been used." },
      { status: 400 }
    );
  }
  if (new Date() > record.expiresAt) {
    return NextResponse.json(
      { error: "OTP has expired. Please request a new one." },
      { status: 400 }
    );
  }
  if (record.otp !== otp) {
    return NextResponse.json(
      { error: "Invalid OTP. Please try again." },
      { status: 400 }
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.passwordReset.update({
    where: { email },
    data: { token, tokenExpiry },
  });

  return NextResponse.json({ success: true, token });
}