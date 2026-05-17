import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";

// BullMQ cần connection riêng (không share với app vì blocking commands).
// `maxRetriesPerRequest: null` là BẮT BUỘC cho BullMQ.
//
// LAZY INIT: Connection + Queue được tạo lần đầu khi có người gọi getter.
// Không tạo ở module-eval time vì Next.js prerender import module để extract
// metadata route → tại build-time chưa có Redis, sẽ spam ECONNREFUSED.
const url = () => process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForQueue = globalThis as unknown as {
  bullmqConnection: Redis | undefined;
  realtimePublishQueue: Queue | undefined;
};

export function getBullmqConnection(): Redis {
  if (globalForQueue.bullmqConnection) return globalForQueue.bullmqConnection;
  const conn = new IORedis(url(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true, // không connect ngay khi `new` — chỉ khi có command đầu tiên
  });
  globalForQueue.bullmqConnection = conn;
  return conn;
}

export const QUEUE_NAMES = {
  realtimePublish: "realtime-publish",
} as const;

export function getRealtimePublishQueue(): Queue {
  if (globalForQueue.realtimePublishQueue) return globalForQueue.realtimePublishQueue;
  const q = new Queue(QUEUE_NAMES.realtimePublish, {
    connection: getBullmqConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000, age: 3600 },
      removeOnFail: { count: 5000, age: 24 * 3600 },
      attempts: 3,
      backoff: { type: "exponential", delay: 200 },
    },
  });
  globalForQueue.realtimePublishQueue = q;
  return q;
}
