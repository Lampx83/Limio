import type { Job } from "bullmq";
import { publish as streamPublish } from "../realtime/stream";
import { realtimePublishQueue, QUEUE_NAMES } from "./index";

// Job: publish 1 event vào Redis Streams.
// Sau này sẽ mở rộng để insert DB row trước khi XADD (Board note, WordCloud submission).
export type RealtimePublishJobData = {
  channel: string;
  event: unknown;
};

export type RealtimePublishJobResult = {
  streamId: string;
};

export async function enqueueRealtimePublish(
  data: RealtimePublishJobData,
): Promise<string> {
  const job = await realtimePublishQueue.add("publish", data, {
    // Job ID undefined → BullMQ tự sinh; idempotency dựa vào caller nếu cần.
  });
  return job.id ?? "";
}

// Processor — gọi bởi Worker. Tách riêng để dễ test.
export async function processRealtimePublishJob(
  job: Job<RealtimePublishJobData, RealtimePublishJobResult>,
): Promise<RealtimePublishJobResult> {
  const streamId = await streamPublish(job.data.channel, job.data.event);
  return { streamId };
}

export const REALTIME_PUBLISH_QUEUE = QUEUE_NAMES.realtimePublish;
