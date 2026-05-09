import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the authenticated app user from the current NextAuth session.
 * Returns a minimal user object for route ownership checks, or null when unauthenticated.
 */
export async function getRequestUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
}
