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
  autoGradeQueue: Queue | undefined;
  classMailQueue: Queue | undefined;
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
  autoGrade: "auto-grade",
  classMail: "class-mail",
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

export function getAutoGradeQueue(): Queue {
  if (globalForQueue.autoGradeQueue) return globalForQueue.autoGradeQueue;
  const q = new Queue(QUEUE_NAMES.autoGrade, {
    connection: getBullmqConnection(),
    defaultJobOptions: {
      // Tintin — auto-grade is idempotent (applyAutoGradingForAttempt skips
      // already-graded attempts) so 3 attempts is safe. Backoff 1s → 2s → 4s
      // for transient DB blips at submit storm time.
      removeOnComplete: { count: 5000, age: 24 * 3600 },
      removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    },
  });
  globalForQueue.autoGradeQueue = q;
  return q;
}

/**
 * CENTER C4.17 — gửi tổng kết và nhận xét sau buổi. Hai việc đều idempotent (mỗi học viên/bản chỉ gửi một lần),
 * nên retry an toàn: lần sau chỉ gửi lại phần còn lỗi. Backoff dài hơn các hàng khác vì lỗi thường là nhà cung cấp
 * email quá tải hoặc rate limit.
 */
export function getClassMailQueue(): Queue {
  if (globalForQueue.classMailQueue) return globalForQueue.classMailQueue;
  const q = new Queue(QUEUE_NAMES.classMail, {
    connection: getBullmqConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000, age: 24 * 3600 },
      removeOnFail: { count: 2000, age: 7 * 24 * 3600 },
      attempts: 5,
      backoff: { type: "exponential", delay: 15_000 },
    },
  });
  globalForQueue.classMailQueue = q;
  return q;
}
