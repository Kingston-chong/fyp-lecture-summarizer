import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { wrapEmailWithAuthChrome } from "@/lib/emailAuthChrome";

export async function POST(req) {
  const { email } = await req.json();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "Email not found. Please check and try again." },
      { status: 404 },
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.passwordReset.upsert({
    where: { email },
    update: { otp, expiresAt, used: false, token: null, tokenExpiry: null },
    create: { email, otp, expiresAt, used: false },
  });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Slide2Notes" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your OTP - Reset Password",
    html: wrapEmailWithAuthChrome(`
        <h2 style="margin:0 0 12px;font-size:20px;color:#eeeef8;">Reset your password</h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.65);">Use the OTP below. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#6366f1;color:white;font-size:28px;font-weight:700;letter-spacing:8px;text-align:center;padding:18px;border-radius:10px;font-family:ui-monospace,monospace;">
          ${otp}
        </div>
        <p style="margin:24px 0 0;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;">If you didn't request this, you can ignore this email.</p>
      `),
  });

  return NextResponse.json({
    success: true,
    expiresAt: expiresAt.toISOString(),
  });
}
