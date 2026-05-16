import crypto from "crypto";

const TTL_MS = 20 * 60 * 1000; // 20 minutes — enough for Office viewer to fetch

function getSecret() {
  const fromEnv =
    process.env.DOCUMENT_VIEW_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "__dev_document_view_token__set_NEXTAUTH_SECRET_in_production__";
  }
  return "";
}

/**
 * @param {number} documentId
 * @param {number} userId
 * @returns {string}
 */
export function signDocumentViewToken(documentId, userId) {
  const secret = getSecret();
  if (!secret) {
    throw new Error(
      "Set DOCUMENT_VIEW_TOKEN_SECRET or NEXTAUTH_SECRET for document preview tokens",
    );
  }
  const exp = Date.now() + TTL_MS;
  const payload = JSON.stringify({
    d: documentId,
    u: userId,
    exp,
  });
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

/**
 * @param {string} token
 * @returns {{ documentId: number; userId: number; exp: number } | null}
 */
export function verifyDocumentViewToken(token) {
  const secret = getSecret();
  if (!secret || !token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  const d = Number(parsed.d);
  const u = Number(parsed.u);
  const exp = Number(parsed.exp);
  if (!Number.isFinite(d) || !Number.isFinite(u) || !Number.isFinite(exp))
    return null;
  if (Date.now() > exp) return null;
  return { documentId: d, userId: u, exp };
}
