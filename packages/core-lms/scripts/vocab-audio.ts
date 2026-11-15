/**
 * Giọng đọc cho từ vựng của khoá ngoại ngữ — dùng cho `import-course.ts`.
 *
 * Mỗi mục của khối `vocab_list` (từ thẻ ghi nhớ `flashcards`) được đọc bằng NEU TTS (cổng Kong, khoá lấy từ
 * Quản trị › Tích hợp hoặc biến môi trường `NEUTTS_*`), mã hoá MP3 rồi ghi vào kho `lesson-media/audio`; đường
 * dẫn gắn vào `audioUrl` của mục. Học viên vì thế có nút nghe ở danh sách từ, thẻ lật và chế độ ôn "Nghe → từ".
 *
 * Giọng quyết định ngôn ngữ đọc: khoá tiếng Anh dùng giọng `en`, tiếng Trung dùng giọng `zh`. Không có giọng của
 * ngôn ngữ đó thì BỎ QUA (không đọc tiếng Anh bằng giọng Việt). Mọi lỗi giọng đều không chặn việc nhập khoá —
 * thiếu audio thì khoá vẫn dùng được, chỉ không có nút nghe.
 */

import { getIntegrationSecret } from "../src/integrations/integrations";
import { encodeMp3, parseWav } from "../src/narration/audio";
import { storePublicBuffer } from "./practice-spec";

/** NEU TTS từ chối đoạn dài (413 từ ~3000 ký tự); một từ vựng không bao giờ gần mức đó. */
const MAX_TERM_CHARS = 200;
const TIMEOUT_MS = 20_000;

export interface VocabVoice {
  voice: string;
  language: string;
}

export interface VocabSynth {
  /** Giọng đọc cho ngôn ngữ, hoặc null khi cổng không có giọng nào của ngôn ngữ đó. */
  voiceFor(language: string): string | null;
  /** Một từ → MP3. Ném lỗi khi cổng trả lỗi. */
  synthesize(text: string, voice: string): Promise<Buffer>;
}

/**
 * Chữ để ĐỌC, khác chữ hiển thị: trong từ điển học tiếng Anh `sb`/`sth` là chữ viết tắt, đọc nguyên văn thì thành
 * "ét-bi" / "ét-ti-ếch". Dấu ngoặc và gạch chéo chỉ là ký hiệu trình bày.
 */
export function speakableTerm(term: string, language: string): string {
  let t = term.trim();
  if (language === "en") {
    t = t
      .replace(/\bsb\b/gi, "somebody")
      .replace(/\bsth\b/gi, "something")
      .replace(/\bsb's\b/gi, "somebody's");
  }
  return t
    .replace(/[()[\]]/g, " ")
    .replace(/\s*\/\s*/g, " or ")
    .replace(/…|\.{3}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface VocabItemLike {
  term?: unknown;
  audioUrl?: unknown;
  [k: string]: unknown;
}

/** Mục chưa có audio và có chữ đọc được (term là chuỗi, không vượt giới hạn). */
export function itemsNeedingAudio(items: VocabItemLike[], language: string): Array<{ item: VocabItemLike; text: string }> {
  const out: Array<{ item: VocabItemLike; text: string }> = [];
  for (const item of items) {
    if (typeof item.audioUrl === "string" && item.audioUrl) continue;
    if (typeof item.term !== "string") continue;
    const text = speakableTerm(item.term, language);
    if (text && text.length <= MAX_TERM_CHARS) out.push({ item, text });
  }
  return out;
}

export interface VocabAudioResult {
  /** Số mục được gắn audio mới. */
  attached: number;
  /** Số mục không có audio vì lỗi giọng. */
  failed: number;
}

export interface VocabAudioContext {
  synth: VocabSynth;
  language: string;
  /** Ghi MP3 vào kho, trả đường dẫn công khai. */
  store: (mp3: Buffer) => Promise<string>;
  warn?: (msg: string) => void;
}

/**
 * Gắn `audioUrl` cho từng mục của một khối `vocab_list` (sửa trực tiếp mảng `items`). Cùng một từ (cùng giọng)
 * xuất hiện nhiều lần trong khoá chỉ đọc và lưu một lần nhờ `cache`, truyền chung cho mọi khối của lần nhập.
 */
export async function attachVocabAudio(
  items: VocabItemLike[],
  ctx: VocabAudioContext,
  cache: Map<string, string>,
): Promise<VocabAudioResult> {
  const result: VocabAudioResult = { attached: 0, failed: 0 };
  const voice = ctx.synth.voiceFor(ctx.language);
  if (!voice) return result;
  for (const { item, text } of itemsNeedingAudio(items, ctx.language)) {
    const key = `${voice}|${text}`;
    let url = cache.get(key);
    if (!url) {
      try {
        url = await ctx.store(await ctx.synth.synthesize(text, voice));
        cache.set(key, url);
      } catch (e) {
        result.failed += 1;
        ctx.warn?.(`Không đọc được "${text}": ${(e as Error).message}`);
        continue;
      }
    }
    item.audioUrl = url;
    result.attached += 1;
  }
  return result;
}

/** Cổng NEU thật. Trả null khi chưa cấu hình (không có khoá) — caller bỏ qua việc sinh giọng. */
export async function createNeuVocabSynth(
  fetchImpl: typeof fetch = fetch,
  secret: (key: string) => Promise<string> = getIntegrationSecret,
): Promise<VocabSynth | null> {
  let baseUrl: string;
  let apiKey: string;
  try {
    [baseUrl, apiKey] = await Promise.all([secret("neutts.base_url"), secret("neutts.api_key")]);
  } catch {
    return null;
  }
  baseUrl = baseUrl.replace(/\/+$/, "");

  const res = await fetchImpl(`${baseUrl}/v1/voices`, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`NEU voices trả ${res.status}`);
  const raw = ((await res.json()) as { voices?: unknown }).voices;
  const voices: VocabVoice[] = Array.isArray(raw)
    ? raw.flatMap((v): VocabVoice[] => {
        if (typeof v === "string") return [{ voice: v, language: "vi" }];
        const o = v as { voice?: unknown; language?: unknown } | null;
        return o && typeof o.voice === "string" ? [{ voice: o.voice, language: typeof o.language === "string" ? o.language : "vi" }] : [];
      })
    : [];

  return {
    voiceFor: (language) => voices.find((v) => v.language === language)?.voice ?? null,
    synthesize: async (text, voice) => {
      // Tuần tự ở caller: máy chủ NEU chỉ nhận 2 yêu cầu đồng thời.
      const r = await fetchImpl(`${baseUrl}/v1/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ text, voice, normalize: true }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`NEU TTS trả ${r.status}`);
      // Trình duyệt phát qua /api/lesson-media/audio không nhận WAV → mã hoá MP3 (thuần Node, không cần ffmpeg).
      return encodeMp3(parseWav(Buffer.from(await r.arrayBuffer())));
    },
  };
}

/** Ghi MP3 vào `public/lesson-media/audio/yyyy/mm/` và trả đường dẫn phát. */
export function lessonAudioStore(actor: string): (mp3: Buffer) => Promise<string> {
  return async (mp3) => {
    const { filename } = await storePublicBuffer("lesson-media/audio", ".mp3", mp3, actor);
    return `/api/lesson-media/audio/${filename}`;
  };
}
