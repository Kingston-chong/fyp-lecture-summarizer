import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

/**
 * Resolve the authenticated app user from the current NextAuth session.
 * Returns a minimal user object for route ownership checks, or null when unauthenticated.
 */
function parseUserId(raw) {
  if (raw == null || raw === "") return null;
  const id = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export async function getRequestUser() {
  const session = await getServerSession(authOptions);
  const id = parseUserId(session?.user?.id);
  const email = session?.user?.email;
  if (id == null || !email) return null;
  return { id, email };
}
