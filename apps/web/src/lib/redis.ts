import IORedis, { type Redis, type RedisOptions } from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisSubscriber: Redis | undefined;
};

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

const baseOptions: RedisOptions = {
  // BullMQ requirement: blocking commands need maxRetriesPerRequest = null on the bclient.
  // Default client also fine with null — keeps reconnect behavior simple.
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
};

function createClient(): Redis {
  return new IORedis(url, baseOptions);
}

export const redis: Redis = globalForRedis.redis ?? createClient();

// Pub/Sub & blocking commands (XREAD BLOCK, BLPOP, SUBSCRIBE) need a dedicated
// connection — ioredis puts that connection into a special mode that can't run
// normal commands. Use `redisSubscriber` for those.
export const redisSubscriber: Redis = globalForRedis.redisSubscriber ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
  globalForRedis.redisSubscriber = redisSubscriber;
}
