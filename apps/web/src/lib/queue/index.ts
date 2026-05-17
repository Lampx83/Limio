import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Redis } from "ioredis";

// BullMQ cần connection riêng (không share với app vì blocking commands).
// `maxRetriesPerRequest: null` là BẮT BUỘC cho BullMQ.
const url = process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForQueue = globalThis as unknown as {
  bullmqConnection: Redis | undefined;
};

export const bullmqConnection: Redis =
  globalForQueue.bullmqConnection ??
  new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: true });

if (process.env.NODE_ENV !== "production") {
  globalForQueue.bullmqConnection = bullmqConnection;
}

export const QUEUE_NAMES = {
  realtimePublish: "realtime-publish",
} as const;

// Singleton queue instances. Workers KHÔNG dùng các instance này (worker tự tạo
// trong worker/index.ts) — chúng chỉ để producer enqueue từ web routes.
const globalForQueues = globalThis as unknown as {
  realtimePublishQueue: Queue | undefined;
};

export const realtimePublishQueue: Queue =
  globalForQueues.realtimePublishQueue ??
  new Queue(QUEUE_NAMES.realtimePublish, {
    connection: bullmqConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000, age: 3600 },
      removeOnFail: { count: 5000, age: 24 * 3600 },
      attempts: 3,
      backoff: { type: "exponential", delay: 200 },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.realtimePublishQueue = realtimePublishQueue;
}
