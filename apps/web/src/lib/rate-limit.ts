/**
 * A5.8.6.5 — Simple in-memory rate limiter for public endpoints.
 *
 * Fixed-window counters per IP. Sufficient for prototype on a single Node
 * instance (server 224 docker-compose). When scaled out → swap for Redis
 * INCR with EXPIRE.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function key(scope: string, ip: string): string {
  return `${scope}:${ip}`;
}

/**
 * Returns true if the request is allowed. Increments the counter on allow.
 * `windowMs` = window length; `limit` = max requests per IP per window.
 */
export function allow(
  scope: string,
  ip: string,
  limit: number,
  windowMs: number,
): { ok: true; remaining: number } | { ok: false; retryAfterSec: number } {
  const k = key(scope, ip);
  const now = Date.now();
  let b = buckets.get(k);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(k, b);
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count };
}

/** Best-effort IP extraction for rate-limit keys. */
export function clientIp(req: Request): string {
  // x-forwarded-for can be a comma-list; take first.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  // Fallback: cookie-bound pseudo-IP so dev tests at localhost still partition.
  return "unknown";
}

/** Vacuum old buckets occasionally to bound memory. */
function vacuum(): void {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt < now - 60_000) buckets.delete(k);
  }
}
setInterval(vacuum, 60_000).unref?.();
