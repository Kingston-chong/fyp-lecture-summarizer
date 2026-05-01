import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp, pruneRateLimitBuckets } from "@/lib/rateLimit";

const prisma = new PrismaClient();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    pruneRateLimitBuckets();
    const ip = getClientIp(req);
    const rl = checkRateLimit({
      key: `auth:login:${ip}`,
      limit: 20,
      windowMs: 10 * 60 * 1000, // 10 minutes
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Find user
    const emailNorm = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user) {
      return NextResponse.json(
        {
          error:
            "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    // If the account was created via Google OAuth and never had a password set
    if (user.passwordHash === "google-oauth") {
      return NextResponse.json(
        {
          error:
            "Please sign in with Google, or reset your password to set one.",
        },
        { status: 401 }
      );
    }

    // Check password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

