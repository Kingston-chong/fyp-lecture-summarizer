import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        {
          error:
            "No account found for this email. If you signed up with Google, please use the 'Continue with Google' button.",
        },
        { status: 401 }
      );
    }

    // If the account was created via Google OAuth and never had a password set
    if (user.passwordHash === "google-oauth") {
      return NextResponse.json(
        {
          error:
            "This account is linked to Google sign-in. Please use the 'Continue with Google' button or reset your password first.",
        },
        { status: 401 }
      );
    }

    // Check password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect password." },
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

