import { fakeSynthesize } from "@feedbackme/core-lms";
import { getNeuGateway, NeuApiNotConfiguredError } from "@/lib/neuApi";

/**
 * Bộ đọc cho việc tạo giọng lời giảng / podcast. Dùng NEU TTS (giọng Việt tự host qua Kong). Máy dev không có khoá NEU nên
 * đặt `NARRATION_FAKE_TTS=1` để dùng bộ đọc GIẢ (tiếng bíp theo độ dài chữ) và thử toàn bộ luồng; bộ giả bị chặn ở production.
 */

export class NarrationTtsNotConfiguredError extends Error {
  constructor() {
    super("NEU TTS chưa được cấu hình (Quản trị › Tích hợp)");
  }
}

export const isFakeTts = (): boolean => process.env.NARRATION_FAKE_TTS === "1" && process.env.NODE_ENV !== "production";

export interface NarrationVoice {
  voice: string;
  language: string;
}

export interface Synthesizer {
  mode: "neu" | "fake";
  synthesize(text: string, voice: string): Promise<Buffer>;
}

const NEU_TIMEOUT_MS = 90_000;

export async function getSynthesizer(): Promise<Synthesizer> {
  if (isFakeTts()) {
    return { mode: "fake", synthesize: async (text, voice) => fakeSynthesize(text, voice) };
  }
  let gw;
  try {
    gw = await getNeuGateway();
  } catch (e) {
    if (e instanceof NeuApiNotConfiguredError) throw new NarrationTtsNotConfiguredError();
    throw e;
  }
  return {
    mode: "neu",
    synthesize: async (text, voice) => {
      const res = await fetch(`${gw.baseUrl}/v1/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": gw.apiKey },
        body: JSON.stringify({ text, voice, normalize: true }),
        signal: AbortSignal.timeout(NEU_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`NEU TTS trả ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

/** Danh sách giọng cho hộp "Tạo giọng". NEU từng trả `string[]`, nay trả `[{ voice, language }]` — gộp về một dạng. */
export async function listNarrationVoices(): Promise<{ mode: "neu" | "fake" | "none"; voices: NarrationVoice[]; default: string | null }> {
  if (isFakeTts()) {
    return {
      mode: "fake",
      voices: ["gia-giang-vien", "gia-nguoi-dan-1", "gia-nguoi-dan-2"].map((voice) => ({ voice, language: "vi" })),
      default: "gia-giang-vien",
    };
  }
  let gw;
  try {
    gw = await getNeuGateway();
  } catch (e) {
    if (e instanceof NeuApiNotConfiguredError) return { mode: "none", voices: [], default: null };
    throw e;
  }
  const res = await fetch(`${gw.baseUrl}/v1/voices`, {
    headers: { "x-api-key": gw.apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NEU voices trả ${res.status}`);
  const j = (await res.json()) as { voices?: unknown; default?: unknown };
  const raw = Array.isArray(j.voices) ? j.voices : [];
  const voices = raw.flatMap((v): NarrationVoice[] => {
    if (typeof v === "string") return [{ voice: v, language: "vi" }];
    if (v && typeof v === "object" && typeof (v as { voice?: unknown }).voice === "string") {
      const lang = (v as { language?: unknown }).language;
      return [{ voice: (v as { voice: string }).voice, language: typeof lang === "string" ? lang : "vi" }];
    }
    return [];
  });
  return { mode: "neu", voices, default: typeof j.default === "string" ? j.default : null };
}
