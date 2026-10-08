/**
 * Cấu hình LLM chat tự host (vLLM, API tương thích OpenAI) — thay gpt-4o-mini.
 *
 * Chỉ `/chat/completions` đi sang đây, và là đường DUY NHẤT cho chat: chưa đặt
 * LLM_BASE_URL thì từ chối chứ không rơi về OpenAI. Embeddings, Whisper (STT) và
 * TTS vẫn là OpenAI vì vLLM này không phục vụ các endpoint đó.
 *
 * Định tuyến làm ở tầng `fetch` chứ không ở từng call site: ~20 chỗ gọi chat
 * (generator, tutor, giám khảo vấn đáp, chấm bài…) giữ nguyên code, và tầng
 * chịu tải (semaphore + retry) bọc ngoài nên vẫn áp cho cả endpoint này.
 */

/** Model mặc định khi chat chạy trên vLLM tự host. Đổi qua `LLM_CHAT_MODEL`. */
export const DEFAULT_CHAT_MODEL = "qwen3.5-35b-a3b-int4";

/** Header xác thực của gateway vLLM (không phải `Authorization`). */
const SECKEY_HEADER = "x-ollama-seckey";

export function getChatModel(): string {
  return process.env.LLM_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

/** Chat được gọi mà chưa đặt `LLM_BASE_URL`. Không còn đường dự phòng sang OpenAI. */
export class LlmNotConfiguredError extends Error {
  constructor() {
    super("llm_not_configured: đặt LLM_BASE_URL để chat dùng LLM tự host");
    this.name = "LlmNotConfiguredError";
  }
}

/** Base URL của vLLM, vd `http://host:8037/vllm/v1`. Rỗng ⇒ chat bị từ chối (LlmNotConfiguredError). */
export function getChatBaseUrl(): string | null {
  const raw = process.env.LLM_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** Đã cấu hình LLM chat tự host (`LLM_BASE_URL`). */
export function isSelfHostedChat(): boolean {
  return getChatBaseUrl() !== null;
}

function isChatCompletions(url: URL): boolean {
  return url.pathname.endsWith("/chat/completions");
}

/**
 * Bọc `baseFetch`: request `/chat/completions` được chuyển sang vLLM (ném
 * LlmNotConfiguredError nếu chưa cấu hình); mọi request khác đi nguyên. Khi chuyển:
 * - bỏ `Authorization` — nó mang OpenAI key, không được gửi sang máy chủ khác;
 * - gắn `x-ollama-seckey` từ `LLM_SECKEY`;
 * - thêm `chat_template_kwargs.enable_thinking=false`: Qwen3.5 mặc định "nghĩ"
 *   trước khi trả lời, tốn token + trễ, và `response_format` JSON không cần.
 */
export function createChatRoutingFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const target = getChatBaseUrl();
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (!isChatCompletions(url)) return baseFetch(req);
    if (!target) throw new LlmNotConfiguredError();

    const headers = new Headers(req.headers);
    headers.delete("authorization");
    const seckey = process.env.LLM_SECKEY?.trim();
    if (seckey) headers.set(SECKEY_HEADER, seckey);

    let body: string | undefined;
    const text = await req.text();
    if (text) {
      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        const existing =
          typeof json.chat_template_kwargs === "object" && json.chat_template_kwargs !== null
            ? (json.chat_template_kwargs as Record<string, unknown>)
            : {};
        json.chat_template_kwargs = { enable_thinking: false, ...existing };
        body = JSON.stringify(json);
      } catch {
        body = text; // không phải JSON thì để server tự báo lỗi
      }
    }
    headers.delete("content-length");

    return baseFetch(`${target}/chat/completions${url.search}`, {
      method: req.method,
      headers,
      body,
      signal: req.signal,
    });
  };
}
