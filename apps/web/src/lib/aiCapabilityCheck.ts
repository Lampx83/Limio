import { toFile } from "openai";

/**
 * "Test đầy đủ" cho tích hợp AI ở /admin/integrations.
 *
 * Nút test cũ chỉ gọi GET /v1/models nên báo xanh cả khi key (Restricted) thiếu quyền Whisper/TTS/
 * Embeddings, hoặc khi chat tự host (Qwen) từ chối request — đúng những lỗi chỉ lộ ra giữa buổi vấn đáp.
 * Ở đây thử thật từng khả năng mà hệ thống dùng, mỗi cái độc lập: một cái hỏng không che cái khác.
 *
 * Nhận client dạng cấu trúc (AiCapabilityClient) thay vì `OpenAI` để test bằng client giả; route ép kiểu
 * client thật (overload của SDK không khớp được với một interface gọn).
 */

export type AiCheckId = "chat" | "embeddings" | "stt" | "tts";

export interface AiCheckResult {
  id: AiCheckId;
  label: string;
  /** Tính năng nào của Limio phụ thuộc vào khả năng này — để admin biết hỏng thì mất gì. */
  usedFor: string;
  ok: boolean;
  /** Không chạy vì thiếu client (vd chưa lưu OpenAI key). */
  skipped?: boolean;
  ms: number;
  detail?: string;
  error?: string;
  hint?: string;
}

export interface AiCapabilityClient {
  chat: {
    completions: {
      create(
        body: { model?: string; messages: { role: string; content: string }[]; max_tokens: number; temperature?: number },
        opts?: { signal?: AbortSignal },
      ): Promise<{ model?: string; choices: { message?: { content?: string | null } }[] }>;
    };
  };
  embeddings: {
    create(
      body: { model: string; input: string },
      opts?: { signal?: AbortSignal },
    ): Promise<{ data: { embedding: number[] }[] }>;
  };
  audio: {
    transcriptions: {
      create(
        body: { file: unknown; model: string; language?: string },
        opts?: { signal?: AbortSignal },
      ): Promise<{ text?: string }>;
    };
    speech: {
      create(
        body: { model: string; voice: string; input: string; response_format?: string },
        opts?: { signal?: AbortSignal },
      ): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
    };
  };
}

/** Số chiều vector khớp cột OralExamMaterialChunk.embedding vector(1536) trong schema. */
const EMBEDDING_DIM = 1536;
const DEFAULT_TIMEOUT_MS = 25_000;

const META: Record<AiCheckId, { label: string; usedFor: string }> = {
  chat: { label: "Chat (LLM)", usedFor: "mọi tính năng AI: tutor, sinh câu hỏi, chấm, giám khảo vấn đáp" },
  embeddings: { label: "Embeddings", usedFor: "chọn đoạn tài liệu theo nghĩa khi vấn đáp (không bắt buộc — có từ khoá thay thế)" },
  stt: { label: "Whisper (nghe)", usedFor: "vấn đáp bằng giọng nói: nhận dạng câu trả lời của sinh viên" },
  tts: { label: "TTS (đọc)", usedFor: "vấn đáp bằng giọng nói: đọc câu hỏi thành tiếng (không bắt buộc)" },
};

/** WAV PCM 16-bit mono toàn im lặng — đủ để Whisper nhận file hợp lệ mà gần như không tốn tiền. */
export function silentWav(seconds = 0.6, sampleRate = 16000): Buffer {
  const dataBytes = Math.round(seconds * sampleRate) * 2;
  const buf = Buffer.alloc(44 + dataBytes); // phần data để 0 = im lặng
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // kích thước khối fmt
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bit/mẫu
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}

/** Che mọi chuỗi giống API key trước khi trả về trình duyệt (OpenAI đôi khi nhắc lại key trong thông báo lỗi). */
function scrub(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-…");
}

interface ErrLike {
  name?: string;
  message?: string;
  status?: number;
  code?: string | null;
  cause?: unknown;
}

function describeError(
  id: AiCheckId,
  e: unknown,
  backend: "openai" | "self-hosted",
): { error: string; hint?: string } {
  const err = (e ?? {}) as ErrLike;
  const raw = scrub(String(err.message ?? e ?? "unknown")).slice(0, 300);
  const selfHostedChat = id === "chat" && backend === "self-hosted";
  const status = err.status;

  if (err.name === "TimeoutError" || /timed? ?out/i.test(raw)) {
    return {
      error: raw,
      hint: selfHostedChat
        ? "Quá thời gian chờ — LLM tự host chậm hoặc không phản hồi; kiểm tra máy chủ vLLM còn chạy."
        : "Quá thời gian chờ — máy chủ AI chậm hoặc không phản hồi; thử lại sau ít phút.",
    };
  }
  if (raw === "openai_busy") {
    return { error: raw, hint: "Hàng đợi gọi AI đang đầy — thử lại sau ít giây." };
  }
  if (status === 401) {
    return {
      error: raw,
      hint: selfHostedChat
        ? "Gateway LLM từ chối xác thực — kiểm tra LLM_SECKEY."
        : "Key sai hoặc đã bị thu hồi — tạo key mới ở platform.openai.com rồi lưu lại.",
    };
  }
  if (status === 403) {
    const need: Record<AiCheckId, string> = {
      chat: "Chat completions",
      embeddings: "Embeddings",
      stt: "Whisper (speech-to-text / audio transcriptions) — nhiều key Restricted không có mục này, đổi key sang All và giữ trần budget ở cấp project",
      tts: "Text-to-speech",
    };
    return {
      error: raw,
      hint: selfHostedChat
        ? "Gateway LLM từ chối — kiểm tra LLM_SECKEY."
        : `Key thiếu quyền ${need[id]}. Vào platform.openai.com → API keys → sửa quyền key.`,
    };
  }
  if (status === 404) {
    return {
      error: raw,
      hint: "Project OpenAI chưa bật model này (hoặc tên model không còn tồn tại) — kiểm tra Project → Limits → Allowed models.",
    };
  }
  if (status === 429) {
    return {
      error: raw,
      hint:
        err.code === "insufficient_quota"
          ? "Tài khoản OpenAI hết tiền/quota — nạp thêm ở mục Billing."
          : "Đang bị giới hạn tốc độ — thử lại sau ít giây.",
    };
  }
  if (status === 400 && selfHostedChat && /user query/i.test(raw)) {
    return {
      error: raw,
      hint: "vLLM từ chối hội thoại không có tin user. Bản mới của Limio tự thêm tin user — kiểm tra server đã deploy bản có sửa này chưa.",
    };
  }
  if (typeof status === "number" && status >= 500) {
    return {
      error: raw,
      hint: selfHostedChat
        ? "LLM tự host báo lỗi máy chủ — xem log vLLM."
        : "OpenAI báo lỗi máy chủ — thử lại sau ít phút.",
    };
  }
  if (status === undefined && /connection|fetch failed|ECONN|ENOTFOUND/i.test(`${err.name} ${raw}`)) {
    return {
      error: raw,
      hint: selfHostedChat
        ? "Không kết nối được tới LLM tự host — kiểm tra LLM_BASE_URL và mạng từ server web."
        : "Không kết nối được tới OpenAI — kiểm tra mạng từ server web.",
    };
  }
  return { error: raw };
}

async function timed(
  id: AiCheckId,
  backend: "openai" | "self-hosted",
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<string | undefined>,
): Promise<AiCheckResult> {
  const started = Date.now();
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(Object.assign(new Error(`timeout sau ${Math.round(timeoutMs / 1000)}s`), { name: "TimeoutError" }));
    }, timeoutMs);
  });
  try {
    const detail = await Promise.race([run(ctrl.signal), timeout]);
    return { id, ...META[id], ok: true, ms: Date.now() - started, ...(detail ? { detail } : {}) };
  } catch (e) {
    return { id, ...META[id], ok: false, ms: Date.now() - started, ...describeError(id, e, backend) };
  } finally {
    clearTimeout(timer);
  }
}

const skipped = (id: AiCheckId, why: string): AiCheckResult => ({
  id,
  ...META[id],
  ok: false,
  skipped: true,
  ms: 0,
  detail: why,
});

export async function runAiCapabilityChecks(opts: {
  /** Client cho chat (có thể là key giả khi chat tự host). null = bỏ qua. */
  chat: AiCapabilityClient | null;
  /** Client OpenAI thật cho embeddings/Whisper/TTS. null = chưa có key ⇒ bỏ qua ba cái này. */
  openai: AiCapabilityClient | null;
  chatBackend: "openai" | "self-hosted";
  embeddingModel: string;
  timeoutMs?: number;
}): Promise<AiCheckResult[]> {
  const { chat, openai, chatBackend, embeddingModel } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const noKey = "Chưa có OpenAI key";

  return Promise.all([
    chat
      ? timed("chat", chatBackend, timeoutMs, async (signal) => {
          // Chỉ một tin system, giống lượt mở màn vấn đáp: Qwen/vLLM từng từ chối kiểu này bằng HTTP 400.
          const res = await chat.chat.completions.create(
            {
              messages: [{ role: "system", content: "Reply with the single word OK." }],
              max_tokens: 8,
              temperature: 0,
            },
            { signal },
          );
          const text = res.choices[0]?.message?.content?.trim();
          if (!text) throw new Error("Model trả về nội dung rỗng");
          const where = chatBackend === "self-hosted" ? "LLM tự host" : "OpenAI";
          return `${res.model ?? "?"} · ${where}`;
        })
      : Promise.resolve(skipped("chat", "Chưa có client chat")),

    openai
      ? timed("embeddings", "openai", timeoutMs, async (signal) => {
          const res = await openai.embeddings.create({ model: embeddingModel, input: "test" }, { signal });
          const dim = res.data[0]?.embedding?.length ?? 0;
          if (dim !== EMBEDDING_DIM) {
            throw new Error(`Vector ${dim} chiều, cột pgvector cần ${EMBEDDING_DIM}`);
          }
          return `${embeddingModel} · ${dim} chiều`;
        })
      : Promise.resolve(skipped("embeddings", noKey)),

    openai
      ? timed("stt", "openai", timeoutMs, async (signal) => {
          const file = await toFile(silentWav(), "check.wav", { type: "audio/wav" });
          await openai.audio.transcriptions.create({ file, model: "whisper-1", language: "vi" }, { signal });
          return "whisper-1";
        })
      : Promise.resolve(skipped("stt", noKey)),

    openai
      ? timed("tts", "openai", timeoutMs, async (signal) => {
          const res = await openai.audio.speech.create(
            { model: "tts-1", voice: "alloy", input: "ok", response_format: "mp3" },
            { signal },
          );
          const bytes = (await res.arrayBuffer()).byteLength;
          if (bytes === 0) throw new Error("TTS trả về audio rỗng");
          return `tts-1 · ${bytes} byte`;
        })
      : Promise.resolve(skipped("tts", noKey)),
  ]);
}

export interface AiCapabilitySummaryLine {
  label: string;
  status: "ok" | "warn" | "fail";
  text: string;
}

/** Dịch kết quả kỹ thuật thành câu trả lời admin cần: vấn đáp chữ / giọng nói dùng được không? */
export function summarizeAiChecks(results: AiCheckResult[]): AiCapabilitySummaryLine[] {
  const ok = (id: AiCheckId) => results.find((r) => r.id === id)?.ok === true;

  let text: AiCapabilitySummaryLine;
  if (!ok("chat")) {
    text = { label: "Vấn đáp bằng chữ", status: "fail", text: "Không dùng được — chat (LLM) đang lỗi." };
  } else if (ok("embeddings")) {
    text = { label: "Vấn đáp bằng chữ", status: "ok", text: "Dùng được, chọn đoạn tài liệu theo nghĩa." };
  } else {
    text = {
      label: "Vấn đáp bằng chữ",
      status: "warn",
      text: "Dùng được, nhưng chọn đoạn tài liệu theo từ khoá (embeddings chưa chạy).",
    };
  }

  let voice: AiCapabilitySummaryLine;
  if (!ok("chat")) {
    voice = { label: "Vấn đáp bằng giọng nói", status: "fail", text: "Không dùng được — chat (LLM) đang lỗi." };
  } else if (!ok("stt")) {
    voice = {
      label: "Vấn đáp bằng giọng nói",
      status: "fail",
      text: "Không dùng được — Whisper (nghe câu trả lời) chưa chạy.",
    };
  } else if (!ok("tts")) {
    voice = {
      label: "Vấn đáp bằng giọng nói",
      status: "warn",
      text: "Chạy được nhưng không có tiếng đọc câu hỏi — sinh viên đọc bản chữ.",
    };
  } else {
    voice = { label: "Vấn đáp bằng giọng nói", status: "ok", text: "Dùng được." };
  }
  return [text, voice];
}
