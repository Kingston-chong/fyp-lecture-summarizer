import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp, pruneRateLimitBuckets } from "@/lib/rateLimit";



const prisma = new PrismaClient();

const ROLES = new Set(["Student", "Lecturer", "Rather not say"]);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  const e = normalizeEmail(email);
  // Practical validation (not full RFC): requires local@domain.tld, no spaces.
  // Rejects values like `test@123`.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function passwordMeetsPolicy(password) {
  const p = String(password || "");
  // bcrypt effectively only uses first 72 bytes; keep it simple and safe.
  if (p.length < 8 || p.length > 72) return false;
  if (!/[a-zA-Z]/.test(p)) return false;
  if (!/[^a-zA-Z0-9]/.test(p)) return false;
  return true;
}

export async function POST(req) {
  try {
    pruneRateLimitBuckets();
    const ip = getClientIp(req);
    const rl = checkRateLimit({
      key: `auth:register:${ip}`,
      limit: 10,
      windowMs: 10 * 60 * 1000, // 10 minutes
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const { email, username, password, confirm, role } = await req.json();

    // Check all fields present
    if (!email || !username || !password || !confirm || !role) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const emailNorm = normalizeEmail(email);
    if (!isValidEmail(emailNorm)) {
      return NextResponse.json(
        { error: "Invalid email format. Please use a valid email address (e.g. name@example.com)." },
        { status: 400 }
      );
    }

    const usernameNorm = String(username).trim();
    if (usernameNorm.length < 2 || usernameNorm.length > 32) {
      return NextResponse.json(
        { error: "Username must be between 2 and 32 characters." },
        { status: 400 }
      );
    }

    const roleNorm = String(role).trim();
    if (!ROLES.has(roleNorm)) {
      return NextResponse.json(
        { error: "Invalid role." },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || typeof confirm !== "string") {
      return NextResponse.json(
        { error: "Invalid password format." },
        { status: 400 }
      );
    }

    if (password !== confirm) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    if (!passwordMeetsPolicy(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be 8–72 characters and include at least one letter and one symbol.",
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Save user
    await prisma.user.create({
      data: { email: emailNorm, username: usernameNorm, passwordHash, role: roleNorm }
    });

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}