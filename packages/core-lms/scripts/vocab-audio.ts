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
import { encodeMp3, parseWav, type Pcm } from "../src/narration/audio";
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
  /** Tên mọi giọng của một ngôn ngữ (để chọn cặp giọng nam–nữ). Bỏ trống = chỉ đọc một giọng. */
  voicesOf?(language: string): string[];
  /** Một từ → PCM thô (để ghép hai giọng thành một tệp). */
  synthesizePcm?(text: string, voice: string): Promise<Pcm>;
}

/** Giọng NEU không dùng cho học liệu (giống `AVOIDED_NEU_VOICES` ở dialogue-audio; nhắc lại đây để tránh vòng import). */
const AVOIDED_VOICES: readonly string[] = ["zf_xiaoni"];
const genderOf = (voice: string): "f" | "m" | null => {
  const m = /^[a-z]{1,3}([fm])_/i.exec(voice);
  return m ? (m[1]!.toLowerCase() as "f" | "m") : null;
};

/** Cặp giọng nam–nữ đầu tiên (theo thứ tự cổng trả về, bỏ giọng bị tránh); null nếu thiếu một trong hai. */
export function pickMaleFemale(voices: string[]): { male: string; female: string } | null {
  const ok = voices.filter((v) => !AVOIDED_VOICES.includes(v));
  const male = ok.find((v) => genderOf(v) === "m");
  const female = ok.find((v) => genderOf(v) === "f");
  return male && female ? { male, female } : null;
}

/** Khoảng lặng giữa lần đọc của giọng nam và giọng nữ (giây). */
export const PAIR_GAP_SEC = 0.7;

/** Khoảng lặng giữa hai TỪ trong audio tổng hợp của cả bảng từ (giây). */
export const TRACK_GAP_SEC = 1.4;

/** Nối nhiều đoạn PCM (cùng tần số) có chèn khoảng lặng giữa các đoạn. */
export function joinPcm(parts: Pcm[], gapSec: number): Pcm {
  if (parts.length === 0) throw new Error("Không có đoạn nào để ghép");
  const sampleRate = parts[0]!.sampleRate;
  if (parts.some((p) => p.sampleRate !== sampleRate)) throw new Error("Tần số lấy mẫu lệch giữa các đoạn");
  const gap = Math.round(sampleRate * gapSec);
  const total = parts.reduce((n, p) => n + p.samples.length, 0) + gap * (parts.length - 1);
  const samples = new Int16Array(total);
  let pos = 0;
  for (const [i, p] of parts.entries()) {
    if (i > 0) pos += gap;
    samples.set(p.samples, pos);
    pos += p.samples.length;
  }
  return { sampleRate, samples };
}

/** Ghép hai đoạn PCM (cùng tần số) có chèn khoảng lặng, mã hoá MP3. */
export function joinPairMp3(first: Pcm, second: Pcm, gapSec = PAIR_GAP_SEC): Buffer {
  if (first.sampleRate !== second.sampleRate) throw new Error(`Tần số lấy mẫu lệch (${first.sampleRate} ≠ ${second.sampleRate})`);
  return encodeMp3(joinPcm([first, second], gapSec));
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
export function itemsNeedingAudio(items: VocabItemLike[], language: string, force = false): Array<{ item: VocabItemLike; text: string }> {
  const out: Array<{ item: VocabItemLike; text: string }> = [];
  for (const item of items) {
    if (!force && typeof item.audioUrl === "string" && item.audioUrl) continue;
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
  /** Đọc lại cả mục đã có audio (thay audio cũ). */
  force?: boolean;
  /** PCM "nam + nữ" của từng từ (khoá = chữ đọc), dùng lại để ghép audio tổng hợp mà không gọi cổng lần nữa. */
  pairPcm?: Map<string, Pcm>;
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
  // Khoá tiếng Trung: mỗi từ đọc HAI lần trong một tệp, giọng nam trước, giọng nữ sau (như băng của giáo trình). Thiếu một trong hai giọng thì đọc một giọng như cũ.
  const pair =
    ctx.language === "zh" && ctx.synth.voicesOf && ctx.synth.synthesizePcm ? pickMaleFemale(ctx.synth.voicesOf(ctx.language)) : null;
  for (const { item, text } of itemsNeedingAudio(items, ctx.language, ctx.force)) {
    const key = pair ? `${pair.male}+${pair.female}|${text}` : `${voice}|${text}`;
    let url = cache.get(key);
    if (!url) {
      try {
        let mp3: Buffer;
        if (pair) {
          const both = joinPcm([await ctx.synth.synthesizePcm!(text, pair.male), await ctx.synth.synthesizePcm!(text, pair.female)], PAIR_GAP_SEC);
          ctx.pairPcm?.set(text, both);
          mp3 = encodeMp3(both);
        } else mp3 = await ctx.synth.synthesize(text, voice);
        url = await ctx.store(mp3);
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

/**
 * Audio TỔNG HỢP của cả bảng từ mới (khối `vocab_list`): mọi từ theo đúng thứ tự thẻ, mỗi từ đọc nam rồi nữ (như audio từng từ), cách nhau {@link TRACK_GAP_SEC}.
 * Gắn vào `payload.audioUrl`. Chỉ làm khi khoá tiếng Trung có cặp giọng nam–nữ; từ chưa có PCM trong `ctx.pairPcm` được đọc lại. Trả true nếu có audio mới.
 */
export async function attachVocabTrack(
  payload: { items?: VocabItemLike[]; audioUrl?: unknown },
  ctx: VocabAudioContext,
): Promise<boolean> {
  if (ctx.language !== "zh" || !ctx.synth.voicesOf || !ctx.synth.synthesizePcm) return false;
  const pair = pickMaleFemale(ctx.synth.voicesOf(ctx.language));
  if (!pair) return false;
  if (!ctx.force && typeof payload.audioUrl === "string" && payload.audioUrl) return false;
  const cache = (ctx.pairPcm ??= new Map<string, Pcm>());
  const parts: Pcm[] = [];
  try {
    for (const item of payload.items ?? []) {
      if (typeof item.term !== "string") continue;
      const text = speakableTerm(item.term, ctx.language);
      if (!text || text.length > MAX_TERM_CHARS) continue;
      let both = cache.get(text);
      if (!both) {
        both = joinPcm([await ctx.synth.synthesizePcm(text, pair.male), await ctx.synth.synthesizePcm(text, pair.female)], PAIR_GAP_SEC);
        cache.set(text, both);
      }
      parts.push(both);
    }
    if (parts.length === 0) return false;
    payload.audioUrl = await ctx.store(encodeMp3(joinPcm(parts, TRACK_GAP_SEC)));
    return true;
  } catch (e) {
    ctx.warn?.(`Không ghép được audio tổng hợp: ${(e as Error).message}`);
    return false;
  }
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

  const fetchWav = async (text: string, voice: string): Promise<Pcm> => {
    // Tuần tự ở caller: máy chủ NEU chỉ nhận 2 yêu cầu đồng thời.
    const r = await fetchImpl(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ text, voice, normalize: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`NEU TTS trả ${r.status}`);
    return parseWav(Buffer.from(await r.arrayBuffer()));
  };

  return {
    voiceFor: (language) => voices.find((v) => v.language === language)?.voice ?? null,
    voicesOf: (language) => voices.filter((v) => v.language === language).map((v) => v.voice),
    synthesizePcm: fetchWav,
    // Trình duyệt phát qua /api/lesson-media/audio không nhận WAV → mã hoá MP3 (thuần Node, không cần ffmpeg).
    synthesize: async (text, voice) => encodeMp3(await fetchWav(text, voice)),
  };
}

/** Ghi MP3 vào `public/lesson-media/audio/yyyy/mm/` và trả đường dẫn phát. */
export function lessonAudioStore(actor: string): (mp3: Buffer) => Promise<string> {
  return async (mp3) => {
    const { filename } = await storePublicBuffer("lesson-media/audio", ".mp3", mp3, actor);
    return `/api/lesson-media/audio/${filename}`;
  };
}
