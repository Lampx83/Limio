import IORedis, { type Redis, type RedisOptions } from "ioredis";

// LAZY connection: ioredis sẽ KHÔNG kết nối khi `new IORedis()` được gọi,
// chỉ kết nối khi có command đầu tiên. Quan trọng vì module này có thể được
// import lúc Next.js build (prerender route handlers) — khi đó chưa có Redis.

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisSubscriber: Redis | undefined;
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

// Pub/Sub & blocking commands (XREAD BLOCK, BLPOP, SUBSCRIBE) need a dedicated
// connection — ioredis puts that connection into a special mode that can't run
// normal commands. Use this for those.
export function getRedisSubscriber(): Redis {
  if (globalForRedis.redisSubscriber) return globalForRedis.redisSubscriber;
  const c = createClient();
  globalForRedis.redisSubscriber = c;
  return c;
}
