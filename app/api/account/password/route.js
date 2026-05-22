import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/authUtils";

function passwordMeetsPolicy(p) {
  const s = String(p ?? "");
  if (s.length < 8 || s.length > 72) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (!/[^a-zA-Z0-9]/.test(s)) return false;
  return true;
}

/** PATCH /api/account/password — change password */
export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  if (!passwordMeetsPolicy(newPassword)) {
    return NextResponse.json(
      {
        error:
          "New password must be 8–72 characters with at least one letter and one special character.",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(session.user.email) },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash || user.passwordHash === "google-oauth") {
    return NextResponse.json(
      {
        error:
          "This account uses Google sign-in. Use Continue with Google, or set a password via Forgot password.",
      },
      { status: 400 },
    );
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashed },
  });

  return NextResponse.json({ ok: true });
}
