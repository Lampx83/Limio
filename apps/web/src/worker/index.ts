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

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down...`);
  await Promise.allSettled(workers.map((w) => w.close()));
  await getBullmqConnection().quit().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log("[worker] bootstrap complete");
