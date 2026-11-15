/**
 * Audio mẫu (NEU TTS) cho từng lượt của hội thoại đóng vai (`config.roleplay` của câu essay trong Bài luyện).
 * Phần thuần ở đây: chọn chữ để đọc, chọn giọng theo giới tính người nói, điền `audio` vào cấu hình. Ghi tệp/DB nằm ở `fill-roleplay-audio.ts`.
 */
import { assignVoices, type Gender } from "./dialogue-audio";

const HAN_OR_FULLWIDTH = /[㐀-鿿　-〿＀-￯]/;
const HAN = /[㐀-鿿]/;
/** NEU TTS từ chối đoạn dài. */
const MAX_CHARS = 600;

/**
 * Chữ để ĐỌC của một lượt. Câu có chữ Hán thì bỏ phần phiên âm/chú thích Latin viết SAU chữ Hán cuối cùng (giáo viên hay ghi pinyin cuối câu —
 * giọng tiếng Trung đọc pinyin ra tiếng lạ); chữ Latin xen giữa câu (vd "App") giữ nguyên. Bỏ dấu ba chấm trình bày.
 */
export function roleplaySpeakable(text: string): string {
  let t = text;
  if (HAN.test(t)) {
    let last = -1;
    for (let i = t.length - 1; i >= 0; i--) {
      if (HAN_OR_FULLWIDTH.test(t[i]!)) {
        last = i;
        break;
      }
    }
    t = t.slice(0, last + 1);
  }
  return t.replace(/…|\.{3}/g, " ").replace(/\s+/g, " ").trim();
}

interface Turn {
  speaker: "A" | "B";
  text: string;
  audio?: string;
}
interface RoleplayConfig {
  roles?: { A?: string; B?: string };
  turns: Turn[];
}

/** Giọng cho vai A và B: người đóng vai nam/nữ (tra `genders` theo tên vai) dùng giọng đúng giới, hai vai khác giọng. */
export function roleVoices(roles: { A?: string; B?: string } | undefined, voices: string[], genders: Record<string, Gender>): Record<"A" | "B", string> {
  const names = [roles?.A || "A", roles?.B || "B"];
  const m = assignVoices(names, voices, genders);
  return { A: m.get(names[0]!)!, B: m.get(names[1]!)! };
}

export interface RoleplayFill {
  config: unknown;
  /** Số lượt được gắn audio mới. */
  attached: number;
  /** Số lượt đọc lỗi. */
  failed: number;
}

/**
 * Gắn `audio` cho các lượt chưa có (hoặc mọi lượt khi `force`). `synthesize(text, voice)` trả đường dẫn đã lưu (hoặc ném lỗi — lượt đó bỏ qua).
 * Không đổi chữ, vai hay lượt nào khác; trả cấu hình mới (không sửa cấu hình cũ).
 */
export async function fillRoleplayAudio(
  config: unknown,
  opts: { voices: string[]; genders: Record<string, Gender>; force?: boolean; synthesize: (text: string, voice: string) => Promise<string>; warn?: (m: string) => void },
): Promise<RoleplayFill> {
  const rp = (config as { roleplay?: RoleplayConfig } | null)?.roleplay;
  if (!rp || !Array.isArray(rp.turns)) return { config, attached: 0, failed: 0 };
  const voiceOf = roleVoices(rp.roles, opts.voices, opts.genders);
  const cache = new Map<string, string>();
  let attached = 0;
  let failed = 0;
  const turns: Turn[] = [];
  for (const t of rp.turns) {
    if (t.audio && !opts.force) {
      turns.push(t);
      continue;
    }
    const text = roleplaySpeakable(t.text);
    if (!text || text.length > MAX_CHARS) {
      turns.push(t);
      continue;
    }
    const voice = voiceOf[t.speaker];
    const key = `${voice}|${text}`;
    let url = cache.get(key);
    try {
      if (!url) {
        url = await opts.synthesize(text, voice);
        cache.set(key, url);
      }
      turns.push({ ...t, audio: url });
      attached += 1;
    } catch (e) {
      failed += 1;
      opts.warn?.(`Không đọc được "${text.slice(0, 20)}…": ${(e as Error).message}`);
      turns.push(t);
    }
  }
  return { config: { ...(config as object), roleplay: { ...rp, turns } }, attached, failed };
}
