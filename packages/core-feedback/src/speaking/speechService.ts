import type { TimedWord } from "./analysis";
import type { Transcriber, TranscribeResult } from "./feedback";

/**
 * Máy khách của DỊCH VỤ PHÂN TÍCH TIẾNG NÓI nội bộ (services/speech-analysis, docs/tieu-chi/limio-language-cham-noi-bang-mic.md AC1).
 * Dịch vụ nhận âm thanh, trả chữ, mốc thời gian từng từ và các đoạn có tiếng nói (VAD); giọng nói không rời máy chủ của mình.
 *
 * File này CHỈ biết nói chuyện HTTP với dịch vụ và đổi kết quả về `TranscribeResult` cũ — mọi nơi khác (đo nhịp nói, ví token, kiểm quyền)
 * không đổi. Dịch vụ lỗi hay không phản hồi thì `withSpeechFallback` rơi về cách cũ (Whisper qua OpenAI) để không chặn việc nộp bài.
 */

export type SpeechServiceErrorCode = "busy" | "timeout" | "network" | "bad_response" | `http_${number}`;

/** Lỗi của dịch vụ. Chỉ mang MÃ lỗi: không chữ học viên nói, không khoá API. */
export class SpeechServiceError extends Error {
  constructor(public readonly code: SpeechServiceErrorCode) {
    super(`speech_service_${code}`);
  }
}

export interface SpeechServiceConfig {
  /** Gốc của dịch vụ, vd. `http://gpu:8080/speech` (không kèm `/v1/analyze`). */
  baseUrl: string;
  apiKey: string;
  /** Quá giờ này thì coi là không phản hồi. Mặc định 60 giây (dịch vụ tự chờ khoá GPU tối đa 30 giây rồi báo bận). */
  timeoutMs?: number;
  /** Chỉ để thử. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 60_000;

const ext = (m: string) => (m.includes("webm") ? "webm" : m.includes("ogg") ? "ogg" : m.includes("mp4") || m.includes("m4a") ? "m4a" : m.includes("mpeg") ? "mp3" : "wav");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const span = (v: unknown): v is { start: number; end: number } => isObj(v) && finite(v.start) && finite(v.end) && v.end >= v.start;

/** Đọc phản hồi của dịch vụ; sai khuôn thì null (không đoán). Chỉ giữ MỐC của từ, không giữ chữ của từng từ. */
function parseResponse(body: unknown): TranscribeResult | null {
  if (!isObj(body) || typeof body.text !== "string" || !finite(body.durationSec) || body.durationSec < 0) return null;
  if (!Array.isArray(body.words) || !body.words.every(span)) return null;
  const words: TimedWord[] = body.words.map((w) => ({ start: (w as TimedWord).start, end: (w as TimedWord).end }));
  const segments = Array.isArray(body.speechSegments) && body.speechSegments.every(span) ? (body.speechSegments as TimedWord[]).map((s) => ({ start: s.start, end: s.end })) : undefined;
  const e = body.engine;
  const engine = isObj(e) && typeof e.name === "string" && typeof e.model === "string" && typeof e.version === "string" ? { name: e.name, model: e.model, version: e.version } : undefined;
  return {
    text: body.text,
    durationSec: body.durationSec,
    words,
    ...(typeof body.language === "string" ? { language: body.language } : {}),
    ...(segments ? { speechSegments: segments } : {}),
    ...(engine ? { engine } : {}),
  };
}

export function speechServiceTranscriber(cfg: SpeechServiceConfig): Transcriber {
  const f = cfg.fetchImpl ?? fetch;
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/v1/analyze`;
  return async (audio, opts) => {
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(audio.buffer)], { type: audio.mimeType }), `speech.${ext(audio.mimeType)}`);
    if (opts.language) form.append("language", opts.language);

    let res: Response;
    try {
      res = await f(url, {
        method: "POST",
        // Cả hai tiêu đề cùng một khoá: dịch vụ nhận cái nào cũng được, còn Kong (key-auth) đọc x-api-key.
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "x-api-key": cfg.apiKey },
        body: form,
        signal: AbortSignal.timeout(cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      throw new SpeechServiceError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
    }
    if (res.status === 503) throw new SpeechServiceError("busy");
    if (!res.ok) throw new SpeechServiceError(`http_${res.status}`);

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new SpeechServiceError("bad_response");
    }
    const parsed = parseResponse(body);
    if (!parsed) throw new SpeechServiceError("bad_response");
    return parsed;
  };
}

/**
 * Dịch vụ nội bộ trước; lỗi gì (bận, quá giờ, mạng, khoá sai, phản hồi sai khuôn) thì dùng `fallback` (Whisper qua OpenAI như trước khi có dịch vụ).
 * `onFallback` chỉ nhận MÃ lý do để ghi log. Lỗi của chính `fallback` được ném nguyên (không nuốt). Phía gọi tạo khách hàng OpenAI ở TRONG `fallback`
 * để thiếu cấu hình AI chỉ lộ khi thật sự phải dùng nó.
 */
export function withSpeechFallback(primary: Transcriber, fallback: Transcriber, onFallback?: (reason: string) => void): Transcriber {
  return async (audio, opts) => {
    try {
      return await primary(audio, opts);
    } catch (e) {
      onFallback?.(e instanceof SpeechServiceError ? e.code : "unknown");
      return fallback(audio, opts);
    }
  };
}
