/**
 * Worker process entrypoint.
 *
 * Chạy ngoài Next.js — process riêng, dùng `tsx` để chạy thẳng TypeScript.
 * Production: `pnpm --filter @feedbackme/web worker`
 * Dev (auto-reload): `pnpm --filter @feedbackme/web worker:dev`
 *
 * Mỗi worker subscribe 1 queue. Concurrency điều chỉnh qua env WORKER_CONCURRENCY.
 * Graceful shutdown: SIGTERM/SIGINT → close worker → flush in-flight jobs.
 */
import * as Sentry from "@sentry/node";
import { Worker, type Job } from "bullmq";
import { getBullmqConnection, QUEUE_NAMES } from "../lib/queue";
import {
  processRealtimePublishJob,
  type RealtimePublishJobData,
  type RealtimePublishJobResult,
} from "../lib/queue/realtimePublishJob";
import {
  processClassMailJob,
  type ClassMailJobData,
  type ClassMailJobResult,
} from "../lib/queue/classMailJob";
import {
  processAutoGradeJob,
  type AutoGradeJobData,
  type AutoGradeJobResult,
} from "../lib/queue/autoGradeJob";

// Worker chạy ngoài Next nên không đi qua instrumentation.ts — init Sentry riêng.
// Thiếu SENTRY_DSN ⇒ không init, captureException thành no-op.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    initialScope: { tags: { process: "worker" } },
  });
}

// 'failed' bắn ở MỌI lần thử; job còn lượt retry thì chưa phải lỗi cần xử lý
// (blip DB lúc nộp bài dồn dập) — chỉ báo khi hết lượt, hoặc job không đọc được.
function reportJobFailure(queue: string, job: Job | undefined, err: Error) {
  if (job && job.attemptsMade < (job.opts.attempts ?? 1)) return;
  Sentry.captureException(err, {
    tags: { queue },
    extra: {
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
    },
  });
}

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? "50");

const workers: Worker[] = [];

const realtimeWorker = new Worker<RealtimePublishJobData, RealtimePublishJobResult>(
  QUEUE_NAMES.realtimePublish,
  processRealtimePublishJob,
  {
    connection: getBullmqConnection(),
    concurrency,
  },
);

realtimeWorker.on("ready", () => {
  console.log(`[worker:${QUEUE_NAMES.realtimePublish}] ready (concurrency=${concurrency})`);
});
realtimeWorker.on("failed", (job, err) => {
  console.error(`[worker:${QUEUE_NAMES.realtimePublish}] job ${job?.id} failed:`, err.message);
  reportJobFailure(QUEUE_NAMES.realtimePublish, job, err);
});

workers.push(realtimeWorker);

// Tintin — Auto-grade worker. Concurrency intentionally lower than realtime
// publish because each grade job runs an N-question $transaction; running
// 50 in parallel could exhaust PgBouncer pool. Use AUTO_GRADE_CONCURRENCY
// env (default 10) to tune.
const autoGradeConcurrency = Number(process.env.AUTO_GRADE_CONCURRENCY ?? "10");
const autoGradeWorker = new Worker<AutoGradeJobData, AutoGradeJobResult>(
  QUEUE_NAMES.autoGrade,
  processAutoGradeJob,
  {
    connection: getBullmqConnection(),
    concurrency: autoGradeConcurrency,
  },
);
autoGradeWorker.on("ready", () => {
  console.log(
    `[worker:${QUEUE_NAMES.autoGrade}] ready (concurrency=${autoGradeConcurrency})`,
  );
});
autoGradeWorker.on("failed", (job, err) => {
  console.error(
    `[worker:${QUEUE_NAMES.autoGrade}] job ${job?.id} failed:`,
    err.message,
  );
  reportJobFailure(QUEUE_NAMES.autoGrade, job, err);
});
workers.push(autoGradeWorker);

// CENTER C4.17 — email tổng kết/nhận xét sau buổi. Concurrency thấp: mỗi job tự gửi lần lượt cả lớp và nhà cung cấp
// email có rate limit; job nào còn email lỗi thì ném lỗi để BullMQ retry (chỉ gửi lại phần lỗi).
const classMailWorker = new Worker<ClassMailJobData, ClassMailJobResult>(QUEUE_NAMES.classMail, processClassMailJob, {
  connection: getBullmqConnection(),
  concurrency: Number(process.env.CLASS_MAIL_CONCURRENCY ?? "3"),
});
classMailWorker.on("ready", () => console.log(`[worker:${QUEUE_NAMES.classMail}] ready`));
classMailWorker.on("failed", (job, err) => {
  console.error(`[worker:${QUEUE_NAMES.classMail}] job ${job?.id} failed:`, err.message);
  reportJobFailure(QUEUE_NAMES.classMail, job, err);
});
workers.push(classMailWorker);

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down...`);
  await Promise.allSettled(workers.map((w) => w.close()));
  await getBullmqConnection().quit().catch(() => {});
  // Gửi nốt event Sentry còn trong buffer trước khi thoát.
  await Sentry.close(2000).catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log("[worker] bootstrap complete");
