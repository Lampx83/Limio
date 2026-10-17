/**
 * Ai đang chờ trong lobby của một ca — chỉ là nhịp tim, không phải dữ liệu nghiệp vụ.
 *
 * Lưu trong Redis (sorted set, điểm = thời điểm thấy lần cuối) để mọi container
 * web cùng đếm đúng. Không ghi DB: người không còn mở trang thì tự rơi khỏi danh
 * sách sau TTL, không cần dọn. Mất Redis chỉ làm số đếm về 0, không ảnh hưởng vào thi.
 */
import { getRedis } from "./redis";

/** Quá khoảng này không có nhịp tim thì coi như đã rời lobby. */
export const LOBBY_PRESENCE_TTL_MS = 45_000;

const key = (sessionId: string) => `exam:lobby:${sessionId}`;

/** Ghi nhận học viên đang ở lobby của ca. */
export async function touchLobby(sessionId: string, userId: string, now = Date.now()): Promise<void> {
  const r = getRedis();
  await r
    .multi()
    .zadd(key(sessionId), now, userId)
    .zremrangebyscore(key(sessionId), "-inf", now - LOBBY_PRESENCE_TTL_MS)
    .expire(key(sessionId), 60 * 60)
    .exec();
}

/** Học viên đã vào thi: bỏ khỏi danh sách chờ ngay, không đợi TTL. */
export async function leaveLobby(sessionId: string, userId: string): Promise<void> {
  await getRedis().zrem(key(sessionId), userId);
}

/** Số học viên còn có nhịp tim trong TTL. */
export async function lobbyCount(sessionId: string, now = Date.now()): Promise<number> {
  const r = getRedis();
  await r.zremrangebyscore(key(sessionId), "-inf", now - LOBBY_PRESENCE_TTL_MS);
  return r.zcard(key(sessionId));
}
