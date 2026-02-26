import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import crypto from "crypto";

export async function POST(req) {
  const { email } = await req.json();

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Email not found. Please check and try again." }, { status: 404 });
  }

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save OTP to database (add PasswordReset model to schema)
  await prisma.passwordReset.upsert({
    where: { email },
    update: { otp, expiresAt, used: false },
    create: { email, otp, expiresAt, used: false },
  });

  // Send email via nodemailer
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,     // your Gmail
      pass: process.env.EMAIL_PASS,     // Gmail app password
    },
  });

  await transporter.sendMail({
    from: `"Slide2Notes" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your OTP - Reset Password",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">Reset Your Password</h2>
        <p style="color: #555; margin-bottom: 24px;">Use the OTP below to reset your Slide2Notes password. It expires in <strong>10 minutes</strong>.</p>
        <div style="background: #6366f1; color: white; font-size: 32px; font-weight: 700; letter-spacing: 10px; text-align: center; padding: 20px; border-radius: 10px;">
          ${otp}
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}

