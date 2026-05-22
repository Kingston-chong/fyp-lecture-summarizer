import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/authUtils";
import { deleteUserAndData } from "@/lib/accountDelete";

/** DELETE /api/account — permanently delete account and all data */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = normalizeEmail(session.user.email);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email } });
      if (!user) return;
      await deleteUserAndData(tx, user);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/account:", err);
    return NextResponse.json(
      { error: String(err?.message || "Failed to delete account.") },
      { status: 500 },
    );
  }
}
