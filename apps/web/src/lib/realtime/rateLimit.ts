import { getRedis } from "../redis";

// Sliding-window rate limit dùng Redis ZSET.
// Đơn giản, đủ chính xác cho realtime POST (chống burst).
// Key chứa timestamp (ms) làm score; ZREMRANGEBYSCORE quét cửa sổ trượt.

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number; // ms còn lại đến khi cửa sổ trượt qua request cũ nhất
};

/**
 * Xem cửa sổ đã đầy chưa MÀ KHÔNG tính thêm một lượt. Dùng cho hàng rào chỉ đếm
 * các lần THẤT BẠI (vd sai mã thi): kiểm tra trước khi xử lý, ghi nhận bằng
 * `rateLimit` chỉ khi thất bại — nên người dùng đúng trong cùng mạng không bị
 * trừ vào ngân sách của người gõ sai.
 */
export async function peekRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<{ blocked: boolean; resetMs: number }> {
  const key = `rl:${bucket}`;
  const now = Date.now();
  const redis = getRedis();
  const pipe = redis.multi();
  pipe.zremrangebyscore(key, 0, now - windowMs);
  pipe.zcard(key);
  const res = await pipe.exec();
  // Redis lỗi — fail open như rateLimit().
  if (!res) return { blocked: false, resetMs: 0 };
  if (Number(res[1]?.[1] ?? 0) < limit) return { blocked: false, resetMs: 0 };
  const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
  const oldestMs = oldest.length >= 2 ? Number(oldest[1]) : now;
  return { blocked: true, resetMs: Math.max(0, oldestMs + windowMs - now) };
}

export async function rateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const key = `rl:${bucket}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  // Pipeline: dọn cũ → đếm → thêm mới → expire
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
  const redis = getRedis();
  const pipe = redis.multi();
  pipe.zremrangebyscore(key, 0, windowStart);
  pipe.zcard(key);
  pipe.zadd(key, now, member);
  pipe.pexpire(key, windowMs + 1000);
  const res = await pipe.exec();

  if (!res) {
    // Redis lỗi — fail open (cho qua), tránh chặn user vì hạ tầng
    return { ok: true, remaining: limit, resetMs: 0 };
  }

  const countBefore = Number(res[1]?.[1] ?? 0);
  const count = countBefore + 1; // +1 cho lần vừa add

  if (count > limit) {
    // Vượt cap → xóa lại member vừa add (không tính)
    await redis.zrem(key, member);
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
    const oldestMs = oldest.length >= 2 ? Number(oldest[1]) : now;
    const resetMs = Math.max(0, oldestMs + windowMs - now);
    return { ok: false, remaining: 0, resetMs };
  }

  return { ok: true, remaining: Math.max(0, limit - count), resetMs: windowMs };
}
