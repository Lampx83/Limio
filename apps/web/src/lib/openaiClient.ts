import OpenAI from "openai";
import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";
import { createResilientFetch } from "./openaiResilience";

function intFromEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Dùng chung 1 hàm fetch (⇒ 1 semaphore) cho cả tiến trình; nếu mỗi client
// tự có semaphore thì giới hạn đồng thời vô nghĩa. Lưu trên globalThis để
// sống sót qua HMR ở dev.
const globalForOpenai = globalThis as unknown as { openaiFetch?: typeof fetch };

function sharedFetch(): typeof fetch {
  globalForOpenai.openaiFetch ??= createResilientFetch({
    maxConcurrent: intFromEnv("OPENAI_MAX_CONCURRENCY", 20),
    maxRetries: intFromEnv("OPENAI_MAX_RETRIES", 4),
    queueTimeoutMs: intFromEnv("OPENAI_QUEUE_TIMEOUT_MS", 20_000),
    baseDelayMs: 500,
    maxDelayMs: 20_000,
  });
  return globalForOpenai.openaiFetch;
}

/**
 * MỌI chỗ trong apps/web cần OpenAI phải tạo client qua đây (không
 * `new OpenAI(...)` trực tiếp) để được giới hạn đồng thời + retry 429.
 * `maxRetries: 0` vì việc retry đã do lớp fetch làm — để SDK retry nữa sẽ
 * nhân đôi số lần thử và bỏ qua semaphore.
 */
export function createOpenaiClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, maxRetries: 0, timeout: 120_000, fetch: sharedFetch() });
}

/** Phản hồi chuẩn cho route JSON khi OpenAI quá tải (route SSE tự `send("error")`). */
export function openaiBusyResponse(): Response {
  return Response.json({ error: "openai_busy" }, { status: 503, headers: { "retry-after": "5" } });
}

/**
 * Resolve OpenAI client from saved IntegrationCredential or env fallback.
 * Throws "openai_not_configured" if neither is set.
 */
export async function getOpenaiClient(): Promise<OpenAI> {
  let key: string;
  try {
    key = await getIntegrationSecret("openai");
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      throw new Error("openai_not_configured");
    }
    throw e;
  }
  return createOpenaiClient(key);
}
