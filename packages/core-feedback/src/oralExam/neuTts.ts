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
/** Chờ tối đa bấy lâu cho MỘT đoạn; quá hạn coi như lỗi để lượt thi trả chữ thay vì treo cả lượt. */
export const NEU_TTS_TIMEOUT_MS = 20_000;

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
    // Tuần tự: máy chủ NEU giới hạn 2 yêu cầu đồng thời (TTS_MAX_CONCURRENT=2), gọi dồn dễ bị từ chối.
    const audioChunks: Buffer[] = [];
    for (const segment of segments) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": config.apiKey },
          body: JSON.stringify({ text: segment, voice, normalize: true }),
          signal: AbortSignal.timeout(NEU_TTS_TIMEOUT_MS),
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

export interface NeuVoice {
  voice: string;
  /** Mã ngôn ngữ của giọng: "vi" | "en" | "zh". Giọng quyết định ngôn ngữ đọc — đưa chữ Hán cho giọng Việt thì không ra tiếng. */
  language: string;
}

/** GET <base>/v1/voices. NEU từng trả `string[]` (toàn giọng Việt), nay trả `[{ voice, language }]`. */
export async function listNeuVoices(config: Pick<NeuTtsConfig, "baseUrl" | "apiKey">): Promise<NeuVoice[]> {
  const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/v1/voices`, {
    headers: { "x-api-key": config.apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new NeuTtsError("tts_failed", { status: res.status });
  const raw = ((await res.json()) as { voices?: unknown }).voices;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v): NeuVoice[] => {
    if (typeof v === "string") return [{ voice: v, language: "vi" }];
    const o = v as { voice?: unknown; language?: unknown } | null;
    if (o && typeof o.voice === "string") return [{ voice: o.voice, language: typeof o.language === "string" ? o.language : "vi" }];
    return [];
  });
}

/**
 * Giọng đọc cho ngôn ngữ của đề. Giọng đã cấu hình được giữ nếu cùng ngôn ngữ; không thì lấy giọng đầu tiên
 * của ngôn ngữ đó; không có giọng nào của ngôn ngữ đó thì trả null để caller lùi về bộ đọc khác.
 */
export function pickNeuVoice(voices: NeuVoice[], language: string, configured?: string): string | null {
  const ofLang = voices.filter((v) => v.language === language);
  if (configured && ofLang.some((v) => v.voice === configured)) return configured;
  return ofLang[0]?.voice ?? null;
}
