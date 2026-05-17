import { publish as streamPublish } from "./stream";

// Publisher API mà feature code (board, wordcloud, poll) sẽ dùng.
// Phase 1.2: publish thẳng vào stream (sync).
// Phase 1.3: sẽ wrap qua BullMQ để async write DB + XADD, response 202 ngay.
// Signature giữ nguyên để feature code không phải đổi khi nâng cấp.

export async function publish(channel: string, event: unknown): Promise<{ id: string }> {
  const id = await streamPublish(channel, event);
  return { id };
}
