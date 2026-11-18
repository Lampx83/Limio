/**
 * OpenAI TTS (`gpt-4o-mini-tts`) cho học liệu tiếng Trung: khác NEU ở chỗ DẶN ĐƯỢC cách đọc (chậm, rõ, đủ thanh điệu, trọn âm cuối), nên
 * đọc từ đơn không bị vội hay cụt âm cuối. Khoá lấy từ Quản trị › Tích hợp (`openai`).
 * Chỉ gửi chữ của học liệu (từ vựng, câu ví dụ, lời thoại) — không có dữ liệu người học.
 */
import type { Pcm } from "../src/narration/audio";

const ENDPOINT = "https://api.openai.com/v1/audio/speech";
const MODEL = "gpt-4o-mini-tts";

/** Dặn cách đọc TỪ VỰNG: chậm, rõ từng âm tiết, đủ thanh điệu, trọn âm cuối; hai lần đọc cách nhau một quãng ngắn. */
export const VOCAB_INSTRUCTIONS =
  "Speak standard Mandarin (Beijing accent) with accurate tones. Read slowly and clearly and fully finish the last syllable, like a teacher pronouncing a new word for foreign learners. Say ONLY the given text, exactly once: never repeat it and never add any extra syllable or word. ";

/** Dặn cách đọc CÂU VÍ DỤ / lượt hội thoại: tự nhiên nhưng rõ ràng, đủ thanh điệu. */
export const SENTENCE_INSTRUCTIONS =
  "Speak standard Mandarin (Beijing accent) with accurate tones, in a natural, friendly conversational pace that is still clear enough for foreign learners. Finish every syllable fully.";

/** Giọng nữ của OpenAI: dặn thêm "giọng nữ trẻ, ấm, cao độ hơi cao" để nghe rõ là nữ (người duyệt thấy `coral` chưa giống nữ). */
export const FEMALE_VOICES = ["nova", "coral", "shimmer", "sage"] as const;
export const FEMININE_ADDITION = " Use a clearly feminine, warm young-adult woman's voice, slightly higher pitch.";

/** Lời dặn đọc câu/lượt thoại theo giọng: giọng nữ có thêm dặn giọng nữ trẻ. */
export const sentenceInstructionsFor = (voice: string): string =>
  (FEMALE_VOICES as readonly string[]).includes(voice) ? SENTENCE_INSTRUCTIONS + FEMININE_ADDITION : SENTENCE_INSTRUCTIONS;

export interface OpenAiSpeechOptions {
  apiKey: string;
  voice: string;
  input: string;
  instructions?: string;
  fetchImpl?: typeof fetch;
}

/** Một đoạn chữ → MP3. Ném lỗi khi OpenAI trả lỗi. */
export async function openAiSpeech({ apiKey, voice, input, instructions, fetchImpl = fetch }: OpenAiSpeechOptions): Promise<Buffer> {
  if (input.length > 4000) throw new Error("Đoạn chữ quá dài cho một lượt đọc (> 4000 ký tự)");
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, voice, input, ...(instructions ? { instructions } : {}), response_format: "mp3" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI TTS trả ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Chữ đọc cho MỘT từ vựng: lặp hai lần, ngắt bằng dấu chấm và khoảng trắng (máy tự nghỉ ngắn). */
export function repeatTwice(text: string): string {
  const t = text.trim();
  return `${t}。 ${t}。`;
}

/** Khoảng nghỉ (giây) giữa HAI LẦN đọc của cùng một từ và giữa HAI TỪ trong audio từ vựng (người duyệt chốt: 1 giây và 2 giây). */
export const WORD_REPEAT_GAP_SEC = 1;
export const WORD_GAP_SEC = 2;
/** Mỗi đầu đoạn đã cắt vẫn chừa chút lặng; trừ vào khoảng nghỉ để tổng khoảng lặng nghe ra đúng số giây đã chốt. */
const TRIM_PAD_SEC = 0.03;

/** Một đoạn chữ → PCM thô 16-bit mono 24 kHz (để ghép có khoảng nghỉ chính xác). */
export async function openAiSpeechPcm(opts: OpenAiSpeechOptions): Promise<Pcm> {
  const { apiKey, voice, input, instructions, fetchImpl = fetch } = opts;
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, voice, input, ...(instructions ? { instructions } : {}), response_format: "pcm" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI TTS trả ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const samples = new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 2)));
  return { sampleRate: 24000, samples };
}

/** Cắt lặng thừa ở ĐẦU và CUỐI (chừa 0,03 s), tắt dần 25 ms ở cuối; phần giữa giữ nguyên. */
export function trimSilence(p: Pcm, threshold = 250): Pcm {
  const a = p.samples;
  let f = 0;
  let l = a.length - 1;
  while (f < a.length && Math.abs(a[f]!) < threshold) f++;
  while (l > f && Math.abs(a[l]!) < threshold) l--;
  if (f >= l) return p;
  const pad = Math.round(p.sampleRate * TRIM_PAD_SEC);
  const out = a.slice(Math.max(0, f - pad), Math.min(a.length, l + 1 + pad));
  const fade = Math.min(out.length, Math.round(p.sampleRate * 0.025));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] = Math.round(out[out.length - 1 - i]! * (i / fade));
  return { sampleRate: p.sampleRate, samples: out };
}

/** Khoảng nghỉ thực chèn để, cộng phần lặng chừa ở hai đầu đoạn, tổng khoảng lặng nghe ra ≈ `target` giây. */
export const gapFor = (target: number): number => Math.max(0, target - 2 * TRIM_PAD_SEC);

/** Phân tích một đoạn đọc: các cụm tiếng nói (gộp khoảng lặng < 0,3 s) và tổng thời lượng tiếng nói. */
export function analyzeClip(p: Pcm, threshold = 300): { bursts: number; speechSec: number; firstToLastSec: number } {
  const w = Math.round(p.sampleRate * 0.02);
  const act: boolean[] = [];
  for (let i = 0; i + w <= p.samples.length; i += w) {
    let m = 0;
    for (let j = i; j < i + w; j++) m = Math.max(m, Math.abs(p.samples[j]!));
    act.push(m > threshold);
  }
  const spans: Array<[number, number]> = [];
  let st = -1;
  act.forEach((a, k) => {
    if (a && st < 0) st = k;
    if (!a && st >= 0) {
      spans.push([st, k]);
      st = -1;
    }
  });
  if (st >= 0) spans.push([st, act.length]);
  const merged: Array<[number, number]> = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp[0] - last[1] < 15) last[1] = sp[1]; // 15 × 20 ms = 0,3 s
    else merged.push([sp[0], sp[1]]);
  }
  const speech = spans.reduce((n, [a, b]) => n + (b - a), 0) * 0.02;
  const ftl = merged.length ? (merged[merged.length - 1]![1] - merged[0]![0]) * 0.02 : 0;
  return { bursts: merged.length, speechSec: speech, firstToLastSec: ftl };
}

/**
 * Chọn đoạn đọc TỐT trong nhiều lần thử của cùng một từ (OpenAI thỉnh thoảng đọc lặp hoặc thêm âm tiết thừa ở từ ngắn, hiếm):
 * loại đoạn không có tiếng, có hơn MỘT cụm tiếng (đọc lặp), hoặc dài bất thường so với số chữ; trong số còn lại lấy đoạn NGẮN nhất
 * (đoạn thêm âm tiết thừa luôn dài hơn). Trả null khi không đoạn nào dùng được.
 */
export function pickBestClip(candidates: Pcm[], syllables: number): Pcm | null {
  const maxSec = Math.max(1, syllables) * 0.55 + 0.35;
  let best: { p: Pcm; len: number } | null = null;
  for (const c of candidates) {
    const a = analyzeClip(c);
    if (a.bursts !== 1 || a.firstToLastSec < 0.2 || a.firstToLastSec > maxSec) continue;
    if (!best || a.firstToLastSec < best.len) best = { p: c, len: a.firstToLastSec };
  }
  return best?.p ?? null;
}
