import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  checkRateLimit,
  getClientIp,
  pruneRateLimitBuckets,
} from "@/lib/rateLimit";

// Keep this Pages Router endpoint while NextAuth remains configured for v4 pages APIs.
export default async function auth(req, res) {
  pruneRateLimitBuckets();

  const ip = getClientIp(req);
  const method = String(req.method || "GET").toUpperCase();
  const rl = await checkRateLimit({
    key: `auth:nextauth:${method.toLowerCase()}:${ip}`,
    limit: method === "POST" ? 30 : 120,
    windowMs: 10 * 60 * 1000,
  });

  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSeconds));
    res.status(429).send("Too many requests");
    return;
  }

  return await NextAuth(req, res, authOptions);
}
