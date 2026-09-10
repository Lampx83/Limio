import IORedis, { type Redis, type RedisOptions } from "ioredis";

// LAZY connection: ioredis sẽ KHÔNG kết nối khi `new IORedis()` được gọi,
// chỉ kết nối khi có command đầu tiên. Quan trọng vì module này có thể được
// import lúc Next.js build (prerender route handlers) — khi đó chưa có Redis.

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

const url = () => process.env.REDIS_URL ?? "redis://localhost:6379";

const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
};

function createClient(): Redis {
  return new IORedis(url(), baseOptions);
}

export function getRedis(): Redis {
  if (globalForRedis.redis) return globalForRedis.redis;
  const c = createClient();
  globalForRedis.redis = c;
  return c;
}

// XREAD BLOCK giữ nguyên connection cho tới khi có data hoặc hết BLOCK_MS —
// mỗi listener (mỗi SSE connection) PHẢI có connection riêng, không được
// dùng chung 1 connection singleton như getRedis(). Dùng chung sẽ khiến các
// blocking read xếp hàng trên cùng 1 connection: listener join sau bị kẹt
// phía sau blocking call của listener join trước, và khi tới lượt thực thi,
// cursor "$" resolve lại từ thời điểm đó → bỏ lỡ đúng event vừa làm listener
// kia tỉnh dậy (bug đã gặp: 2 học viên join gameshow, người join sau kẹt ở
// màn hình chờ tới tận câu hỏi kế tiếp mới nhận được event).
// Gọi hàm này cho MỖI subscribe() và disconnect() khi xong (xem stream.ts).
export function createBlockingConnection(): Redis {
  return createClient();
}
