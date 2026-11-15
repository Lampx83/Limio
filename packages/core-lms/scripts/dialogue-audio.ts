/**
 * Giọng đọc từng lượt cho tài nguyên hội thoại (`dialogue`) của khoá ngoại ngữ — dùng cho `import-course.ts`.
 *
 * Mỗi lượt được đọc bằng NEU TTS (cùng cổng và khoá với giọng từ vựng: Quản trị › Tích hợp hoặc `NEUTTS_*`), mã hoá MP3
 * rồi ghi vào kho `lesson-media/audio`; đường dẫn gắn vào `audioUrl` của lượt. Mỗi người nói giữ MỘT giọng suốt cả hội thoại;
 * khi cổng có nhiều giọng của ngôn ngữ đó thì người nói thứ hai, thứ ba… dùng giọng khác (xoay vòng). Mọi lỗi đều không chặn
 * việc nhập khoá: lượt không có audio thì học viên chỉ đọc chữ.
 */

import { createHash } from "node:crypto";
import { getIntegrationSecret } from "../src/integrations/integrations";
import { encodeMp3, parseWav } from "../src/narration/audio";
import { lessonAudioStore } from "./vocab-audio";

/** NEU TTS từ chối đoạn dài (413 từ ~3000 ký tự). */
const MAX_TURN_CHARS = 2_500;

/** Một đoạn chữ → MP3 bằng một giọng. Ném lỗi khi cổng trả lỗi. */
export interface TurnSynth {
  synthesize(text: string, voice: string): Promise<Buffer>;
}

export interface DialogueAudioContext {
  synth: TurnSynth;
  /** Các giọng của ngôn ngữ khoá, theo thứ tự cổng trả về (có ít nhất một). */
  voices: string[];
  store: (mp3: Buffer) => Promise<string>;
  warn?: (msg: string) => void;
  /** Giới tính từng người nói (tên → "f"/"m") để chọn giọng nam/nữ cho đúng. */
  genders?: Record<string, Gender>;
  /** Đọc lại cả lượt đã có audio (thay `audioUrl` cũ). */
  force?: boolean;
}

interface TurnLike {
  speaker: string;
  text: string;
  audioUrl?: string;
  [k: string]: unknown;
}

/** Chữ để ĐỌC: bỏ dấu ba chấm trình bày, gộp khoảng trắng. */
export function speakableTurn(text: string): string {
  return text.replace(/…|\.{3}/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Tên tệp audio của một lượt, tương đối so với thư mục assets: `audio/dialogue/<16 ký tự đầu của sha1("người nói|chữ")>.mp3`.
 * Tên chỉ phụ thuộc người nói + chữ (không phụ thuộc giọng) nên bước soạn dữ liệu (Python) tự tìm được tệp đã sinh.
 */
export function dialogueAudioFile(speaker: string, text: string): string {
  return `audio/dialogue/${createHash("sha1").update(`${speaker}|${text}`, "utf8").digest("hex").slice(0, 16)}.mp3`;
}

export type Gender = "f" | "m";

/** Giới tính của giọng NEU theo tên (`zf_xiaobei` nữ, `zm_yunxi` nam); không nhận ra thì null. */
export function voiceGender(voice: string): Gender | null {
  const m = /^[a-z]{1,3}([fm])_/i.exec(voice);
  return m ? (m[1]!.toLowerCase() as Gender) : null;
}

/**
 * Giọng cho từng người nói, theo thứ tự xuất hiện. Có `genders` thì người nói nam dùng giọng nam, nữ dùng giọng nữ (mỗi người nói
 * một giọng khác nhau trong cùng giới, xoay vòng khi hết); thiếu thông tin thì xoay vòng trong mọi giọng.
 */
export function assignVoices(speakers: string[], voices: string[], genders: Record<string, Gender> = {}): Map<string, string> {
  const out = new Map<string, string>();
  const used = { f: 0, m: 0, any: 0 };
  for (const sp of speakers) {
    if (out.has(sp)) continue;
    const g = genders[sp];
    const pool = g ? voices.filter((v) => voiceGender(v) === g) : [];
    if (pool.length > 0) out.set(sp, pool[used[g!]++ % pool.length]!);
    else out.set(sp, voices[used.any++ % voices.length]!);
  }
  return out;
}

export interface DialogueAudioResult {
  attached: number;
  failed: number;
}

/** Gắn `audioUrl` cho từng lượt chưa có audio (sửa trực tiếp mảng `turns`). `cache` dùng chung cả lần nhập: cùng giọng + cùng chữ chỉ đọc một lần. */
export async function attachDialogueAudio(
  turns: TurnLike[],
  ctx: DialogueAudioContext,
  cache: Map<string, string>,
): Promise<DialogueAudioResult> {
  const result: DialogueAudioResult = { attached: 0, failed: 0 };
  const voiceOf = assignVoices(turns.map((t) => t.speaker), ctx.voices, ctx.genders);
  for (const t of turns) {
    if (!ctx.force && typeof t.audioUrl === "string" && t.audioUrl) continue;
    const text = speakableTurn(t.text);
    if (!text || text.length > MAX_TURN_CHARS) continue;
    const voice = voiceOf.get(t.speaker)!;
    const key = `${voice}|${text}`;
    let url = cache.get(key);
    if (!url) {
      try {
        url = await ctx.store(await ctx.synth.synthesize(text, voice));
        cache.set(key, url);
      } catch (e) {
        result.failed += 1;
        ctx.warn?.(`Không đọc được lượt "${text.slice(0, 20)}…": ${(e as Error).message}`);
        continue;
      }
    }
    t.audioUrl = url;
    result.attached += 1;
  }
  return result;
}

/**
 * Đọc cấu hình NEU từ DB (Quản trị › Tích hợp). Khi cổng NEU chỉ với tới được qua đường hầm SSH, đặt `NEUTTS_BASE_URL_OVERRIDE`
 * (vd http://127.0.0.1:59001) để thay địa chỉ cổng; khoá API vẫn lấy từ DB.
 */
export async function neuSecret(key: string): Promise<string> {
  if (key === "neutts.base_url" && process.env.NEUTTS_BASE_URL_OVERRIDE) return process.env.NEUTTS_BASE_URL_OVERRIDE;
  return getIntegrationSecret(key);
}

/** Danh sách giọng của một ngôn ngữ từ cổng NEU (rỗng khi không có). */
export async function listVoices(language: string, fetchImpl: typeof fetch, secret: (key: string) => Promise<string>): Promise<string[]> {
  const [baseUrl, apiKey] = await Promise.all([secret("neutts.base_url"), secret("neutts.api_key")]);
  const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/v1/voices`, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`NEU voices trả ${res.status}`);
  const raw = ((await res.json()) as { voices?: unknown }).voices;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v): string[] => {
    if (typeof v === "string") return language === "vi" ? [v] : [];
    const o = v as { voice?: unknown; language?: unknown } | null;
    return o && typeof o.voice === "string" && (typeof o.language === "string" ? o.language : "vi") === language ? [o.voice] : [];
  });
}

/** Cổng NEU thật: POST `<base>/v1/speech` (Kong route theo đường dẫn nên `base` có thể kèm `/tts`), trả WAV → mã hoá MP3. */
export function makeNeuSynth(baseUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): TurnSynth {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/speech`;
  return {
    synthesize: async (text, voice) => {
      // Tuần tự ở caller: máy chủ NEU chỉ nhận 2 yêu cầu đồng thời.
      const r = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ text, voice, normalize: true }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) throw new Error(`NEU TTS trả ${r.status}`);
      return encodeMp3(parseWav(Buffer.from(await r.arrayBuffer())));
    },
  };
}

/**
 * Cổng + danh sách giọng của một ngôn ngữ. Giọng admin đã chọn (`neutts.voice_<ngôn ngữ>`) đứng đầu; liệt kê giọng qua `/v1/voices`
 * chỉ để bổ sung giọng thứ hai… cho người nói khác — gateway có thể không mở route này (404) thì chỉ dùng giọng đã chọn.
 * Không có giọng nào thì ném lỗi.
 */
export async function resolveNeu(
  language: string,
  fetchImpl: typeof fetch = fetch,
  secret: (key: string) => Promise<string> = neuSecret,
): Promise<{ synth: TurnSynth; voices: string[] }> {
  const [baseUrl, apiKey] = await Promise.all([secret("neutts.base_url"), secret("neutts.api_key")]);
  const configured = await secret(`neutts.voice_${language}`).catch(() => null);
  let listed: string[] = [];
  try {
    listed = await listVoices(language, fetchImpl, secret);
  } catch {
    // route /v1/voices không mở qua gateway: dùng giọng đã chọn
  }
  const voices = [...(configured ? [configured] : []), ...listed.filter((v) => v !== configured)];
  if (voices.length === 0) throw new Error(`không có giọng "${language}" (chưa chọn neutts.voice_${language} và cổng không liệt kê giọng)`);
  return { synth: makeNeuSynth(baseUrl, apiKey, fetchImpl), voices };
}

/**
 * Chuẩn bị giọng cho hội thoại. Trả null (kèm lý do in ra) khi chưa cấu hình, cổng lỗi hoặc không có giọng của ngôn ngữ đó —
 * khoá vẫn nhập được, chỉ không có audio từng lượt.
 */
export async function prepareDialogueAudio(
  language: string,
  actor: string,
  fetchImpl: typeof fetch = fetch,
  secret: (key: string) => Promise<string> = neuSecret,
): Promise<DialogueAudioContext | null> {
  try {
    const { synth, voices } = await resolveNeu(language, fetchImpl, secret);
    console.log(`Giọng NEU "${language}": ${voices.join(", ")}`);
    return { synth, voices, store: lessonAudioStore(actor), warn: (m) => console.warn(`⚠ ${m}`) };
  } catch (e) {
    console.warn(`⚠ Không dùng được NEU TTS (${(e as Error).message}): hội thoại chưa có audio từng lượt.`);
    return null;
  }
}
