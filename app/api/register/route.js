import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";



const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { email, username, password, role } = await req.json();

    // Check all fields present
    if (!email || !username || !password || !role) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
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
      data: { email, username, passwordHash, role }
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