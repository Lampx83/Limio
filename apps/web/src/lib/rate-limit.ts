/**
 * Rate-limit adapter — thin wrapper around the Redis ZSET sliding-window
 * limiter in `realtime/rateLimit.ts`. Preserves the old `allow()` shape
 * (`{ok, retryAfterSec}`) so existing exam/public callers only need to
 * add `await`.
 *
 * Tintin: moved from in-memory Map to Redis so the limiter survives
 * horizontal scale of the web container.
 */

import { rateLimit as redisRateLimit } from "./realtime/rateLimit";

export type AllowResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export async function allow(
  scope: string,
  subject: string,
  limit: number,
  windowMs: number,
): Promise<AllowResult> {
  const r = await redisRateLimit(`${scope}:${subject}`, limit, windowMs);
  if (r.ok) return { ok: true, remaining: r.remaining };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil(r.resetMs / 1000)) };
}

/** Best-effort IP extraction for rate-limit keys.
 *
 * Walks the X-Forwarded-For chain left-to-right and returns the first PUBLIC
 * address. Private/loopback addresses (10/8, 172.16/12, 192.168/16, 127/8,
 * ::1, fe80::/10, fc00::/7) are skipped — when they appear it means a reverse
 * proxy forgot to set XFF, and bucketing every internal hop under one gateway
 * IP (e.g. 172.31.4.1) silently starves real users behind that gateway of
 * their rate-limit budget. Callers should treat the literal "unknown" return
 * value as "no trustworthy subject" and decide whether to skip throttling
 * rather than lump everyone into the same bucket.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    for (const seg of xff.split(",")) {
      const ip = seg.trim();
      if (ip && !isPrivateIp(ip)) return ip;
    }
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real && !isPrivateIp(real)) return real;
  return "unknown";
}

function isPrivateIp(ip: string): boolean {
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true;
  if (/^127\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (ip === "::1") return true;
  if (/^fe80:/i.test(ip)) return true;
  if (/^fc[0-9a-f]{2}:/i.test(ip)) return true;
  if (/^fd[0-9a-f]{2}:/i.test(ip)) return true;
  return false;
}
