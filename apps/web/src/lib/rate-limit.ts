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

/** Best-effort IP extraction for rate-limit keys. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
