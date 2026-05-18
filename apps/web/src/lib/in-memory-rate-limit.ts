/**
 * Per-process in-memory rate-limit. Dùng cho hot-path **chỉ cần** chống burst
 * trong cùng 1 replica — KHÔNG dùng cho rate-limit nhạy cảm (auth, signup…)
 * vì 3 replicas × cap = 3× cap thực tế.
 *
 * Vì sao có file này:
 *   Redis ZSET rate-limit (`realtime/rateLimit.ts`) tốn 1 round-trip mỗi
 *   call. Với 5K SV × heartbeat 10s = ~500 req/s, đó là 500 Redis round-trip
 *   chỉ để rate-limit. Heartbeat chỉ cần "không gọi quá 1/8s/attempt" — over-count
 *   3× qua replicas vẫn ổn (overall vẫn ≤ 3/8s = ~0.4 req/s/attempt).
 *
 * Bộ nhớ: ~84 bytes/entry × 20K entries ≈ 1.7MB / replica. Map insertion-order
 * + delete-on-hit cho phép LRU eviction O(1) bằng `keys().next()`.
 */

const MAX_ENTRIES = 20_000;

// subject → ms timestamp của lần allowed gần nhất
const lastAllowedAt = new Map<string, number>();

/**
 * Trả về `true` nếu được phép (và record lại lần này), `false` nếu vẫn còn
 * trong cửa sổ chặn. Đồng bộ, không I/O.
 */
export function allowInMemory(subject: string, windowMs: number): boolean {
  const now = Date.now();
  const last = lastAllowedAt.get(subject);
  if (last !== undefined && now - last < windowMs) {
    return false;
  }
  // LRU touch: xoá rồi set lại → key đẩy về cuối insertion-order.
  lastAllowedAt.delete(subject);
  // Bound bộ nhớ — evict entries cũ nhất nếu quá size.
  while (lastAllowedAt.size >= MAX_ENTRIES) {
    const oldest = lastAllowedAt.keys().next().value;
    if (oldest === undefined) break;
    lastAllowedAt.delete(oldest);
  }
  lastAllowedAt.set(subject, now);
  return true;
}

/** Test-only: reset toàn bộ state. */
export function __resetInMemoryRateLimit(): void {
  lastAllowedAt.clear();
}
