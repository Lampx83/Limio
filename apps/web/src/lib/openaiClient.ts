import OpenAI from "openai";
import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";
import { createChatRoutingFetch, isSelfHostedChat } from "@feedbackme/core-feedback";
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
  // Chat → vLLM tự host, còn lại (embeddings/STT/TTS) → OpenAI; xem core-feedback llm.ts.
  globalForOpenai.openaiFetch ??= createResilientFetch({
    baseFetch: createChatRoutingFetch(),
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
 * Key cho client CHỈ dùng chat. Chat đã chuyển sang LLM tự host nên không cần
 * OpenAI key: thiếu key thì dùng placeholder (SDK bắt buộc có apiKey; header
 * Authorization bị bỏ trước khi gửi đi, xem createChatRoutingFetch). Route cần
 * embeddings/STT/TTS KHÔNG dùng hàm này — vẫn phải có key OpenAI thật.
 * Ném IntegrationError "key_not_found" khi chat vẫn đi OpenAI mà chưa có key.
 */
export async function getChatOnlyApiKey(): Promise<string> {
  try {
    return await getIntegrationSecret("openai");
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found" && isSelfHostedChat()) {
      return "self-hosted-llm";
    }
    throw e;
  }
}

/**
 * Client chat. Throws "openai_not_configured" khi chat vẫn đi OpenAI mà chưa
 * cấu hình key (đã đặt LLM_BASE_URL thì không cần key). Truyền
 * `needsOpenaiKey` khi caller còn dùng Whisper/TTS/embeddings — những thứ đó
 * vẫn là OpenAI nên luôn cần key thật.
 */
export async function getOpenaiClient(opts: { needsOpenaiKey?: boolean } = {}): Promise<OpenAI> {
  let key: string;
  try {
    key = opts.needsOpenaiKey ? await getIntegrationSecret("openai") : await getChatOnlyApiKey();
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      throw new Error("openai_not_configured");
    }
    throw e;
  }
  return createOpenaiClient(key);
}
