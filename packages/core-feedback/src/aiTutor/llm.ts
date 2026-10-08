/**
 * Cấu hình LLM chat tự host (vLLM, API tương thích OpenAI) — thay gpt-4o-mini.
 *
 * Chỉ `/chat/completions` đi sang đây. Embeddings, Whisper (STT) và TTS vẫn là
 * OpenAI vì vLLM này không phục vụ các endpoint đó.
 *
 * Định tuyến làm ở tầng `fetch` chứ không ở từng call site: ~20 chỗ gọi chat
 * (generator, tutor, giám khảo vấn đáp, chấm bài…) giữ nguyên code, và tầng
 * chịu tải (semaphore + retry) bọc ngoài nên vẫn áp cho cả endpoint này.
 */

/** Model mặc định khi chat chạy trên vLLM tự host. Đổi qua `LLM_CHAT_MODEL`. */
export const DEFAULT_CHAT_MODEL = "qwen3.5-35b-a3b-int4";

/**
 * Model dùng khi chưa đặt `LLM_BASE_URL` (chat vẫn đi OpenAI). Phải là tên model
 * OpenAI hợp lệ: nếu mặc định luôn là Qwen thì máy chủ nào deploy trước khi kịp
 * đặt LLM_BASE_URL sẽ gửi "qwen…" tới OpenAI và hỏng toàn bộ AI.
 */
export const OPENAI_FALLBACK_CHAT_MODEL = "gpt-4o-mini";

/** Header xác thực của gateway vLLM (không phải `Authorization`). */
const SECKEY_HEADER = "x-ollama-seckey";

export function getChatModel(): string {
  const explicit = process.env.LLM_CHAT_MODEL?.trim();
  if (explicit) return explicit;
  return getChatBaseUrl() ? DEFAULT_CHAT_MODEL : OPENAI_FALLBACK_CHAT_MODEL;
}

/** Base URL của vLLM, vd `http://host:8037/vllm/v1`. Rỗng ⇒ chat vẫn đi OpenAI. */
export function getChatBaseUrl(): string | null {
  const raw = process.env.LLM_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** Chat đang chạy trên LLM tự host (không cần OpenAI key cho các route chỉ chat). */
export function isSelfHostedChat(): boolean {
  return getChatBaseUrl() !== null;
}

/**
 * Tin `user` giả điền vào khi hội thoại chỉ có `system`. Chat template của Qwen (vLLM) từ chối request
 * không có tin `user` nào bằng HTTP 400 "No user query found in messages." — còn OpenAI thì chấp nhận,
 * nên lượt mở màn vấn đáp và bước chấm vấn đáp (chỉ gửi một tin system) chạy được trên gpt-4o-mini nhưng
 * hỏng ngay khi chuyển sang LLM tự host. Cố ý là dấu hiệu trung tính, không phải câu tiếng Việt: đề thi
 * tiếng Anh/Trung đã được system prompt chỉ định ngôn ngữ, không để câu này kéo lệch.
 */
export const SYSTEM_ONLY_USER_PLACEHOLDER = "[start]";

function isChatCompletions(url: URL): boolean {
  return url.pathname.endsWith("/chat/completions");
}

/**
 * Bọc `baseFetch`: request `/chat/completions` được chuyển sang vLLM; mọi
 * request khác đi nguyên. Khi chuyển:
 * - bỏ `Authorization` — nó mang OpenAI key, không được gửi sang máy chủ khác;
 * - gắn `x-ollama-seckey` từ `LLM_SECKEY`;
 * - hội thoại không có tin `user` nào thì thêm một tin cuối (SYSTEM_ONLY_USER_PLACEHOLDER) — xem hằng số;
 * - thêm `chat_template_kwargs.enable_thinking=false`: Qwen3.5 mặc định "nghĩ"
 *   trước khi trả lời, tốn token + trễ, và `response_format` JSON không cần.
 */
export function createChatRoutingFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const target = getChatBaseUrl();
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (!target || !isChatCompletions(url)) return baseFetch(req);

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
        if (
          Array.isArray(json.messages) &&
          !json.messages.some((m) => (m as { role?: unknown } | null)?.role === "user")
        ) {
          json.messages = [...json.messages, { role: "user", content: SYSTEM_ONLY_USER_PLACEHOLDER }];
        }
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
