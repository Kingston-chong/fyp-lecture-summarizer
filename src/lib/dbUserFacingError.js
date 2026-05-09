/**
 * Maps Prisma / low-level DB connection errors to a short message for the UI.
 * Avoids leaking hostnames and stack traces on login/session.
 */
export function connectionErrorUserMessage(err) {
  const code = err?.code;
  // https://www.prisma.io/docs/reference/api-reference/error-reference
  if (
    code === "P1001" ||
    code === "P1002" ||
    code === "P1017" ||
    code === "P1011" ||
    code === "P1008"
  ) {
    return "We couldn't connect. Check your internet connection and try again.";
  }

  const msg = String(err?.message || err || "");
  if (
    /can't reach database server/i.test(msg) ||
    /connection.*(refused|timed out|closed)/i.test(msg) ||
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH/i.test(msg)
  ) {
    return "We couldn't connect. Check your internet connection and try again.";
  }

  return null;
}
