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
import { Worker } from "bullmq";
import { getBullmqConnection, QUEUE_NAMES } from "../lib/queue";
import {
  processRealtimePublishJob,
  type RealtimePublishJobData,
  type RealtimePublishJobResult,
} from "../lib/queue/realtimePublishJob";
import {
  processAutoGradeJob,
  type AutoGradeJobData,
  type AutoGradeJobResult,
} from "../lib/queue/autoGradeJob";

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
});
workers.push(autoGradeWorker);

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down...`);
  await Promise.allSettled(workers.map((w) => w.close()));
  await getBullmqConnection().quit().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log("[worker] bootstrap complete");
