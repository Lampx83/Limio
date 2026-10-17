import { OpenAiVoiceError } from "./openaiVoice";
import { splitForTts, type TextToSpeechFn } from "./vbee";

/**
 * A6.6 — TTS tự host (dịch vụ "NEU TTS API", model zerotts, giọng tiếng Việt).
 * Gọi qua Kong gateway trên máy 232: Kong xác thực bằng key của consumer
 * (header `x-api-key`), rồi route `/tts/` về `/v1/speech` của dịch vụ.
 *
 * Đo thực tế: 1000 ký tự/request vẫn 200, 3000 ký tự bị 413 → chọn 500 để chừa
 * biên an toàn. Đầu ra là WAV 48 kHz mono 16-bit, mỗi đoạn là một file WAV
 * đầy đủ header nên client phát nối tiếp từng đoạn như với Vbee/OpenAI.
 */
export const NEU_TTS_MAX_CHARS = 500;
export const NEU_TTS_DEFAULT_VOICE = "baotrang";

export interface NeuTtsConfig {
  /** Gốc của gateway, vd `http://<host>:8037/tts` (không kèm `/v1/speech`). */
  baseUrl: string;
  /** Key của consumer trên Kong, gửi trong header `x-api-key` (key-auth của Kong). */
  apiKey: string;
  voice?: string;
}

export class NeuTtsError extends Error {
  constructor(
    public readonly code: "tts_failed",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

/** Lỗi từ bất kỳ provider TTS nào — route dùng để quyết định trả chữ thay audio. */
export function isTtsProviderError(e: unknown): boolean {
  return e instanceof NeuTtsError || e instanceof OpenAiVoiceError;
}

/** Nhận toàn bộ câu trả lời của AI (chữ), trả về audio WAV qua NEU TTS API. */
export function neuTextToSpeech(config: NeuTtsConfig): TextToSpeechFn {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/v1/speech`;
  const voice = config.voice ?? NEU_TTS_DEFAULT_VOICE;

  return async (text: string) => {
    const segments = splitForTts(text, NEU_TTS_MAX_CHARS);
    const audioChunks: Buffer[] = [];
    for (const segment of segments) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": config.apiKey },
          body: JSON.stringify({ text: segment, voice, normalize: true }),
        });
      } catch (e) {
        throw new NeuTtsError("tts_failed", e);
      }
      if (!res.ok) {
        throw new NeuTtsError("tts_failed", { status: res.status });
      }
      audioChunks.push(Buffer.from(await res.arrayBuffer()));
    }
    return { audioChunks, contentType: "audio/wav" };
  };
}
