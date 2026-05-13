import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

/**
 * Resolve the authenticated app user from the current NextAuth session.
 * Returns a minimal user object for route ownership checks, or null when unauthenticated.
 */
export async function getRequestUser() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email) return null;
  return { id, email };
}
