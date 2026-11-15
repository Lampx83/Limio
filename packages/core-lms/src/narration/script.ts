import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Lời giảng và kịch bản podcast của một bài (docs/tieu-chi/nghe-giang-podcast.md).
 *
 * Hai loại, cùng một bảng `LessonNarration`:
 *  - `lecture`: một giảng viên ảo giảng theo mục; mỗi đoạn có `anchor` trỏ tới một mục của bài
 *    (`mo-dau`, `tong-ket`, hoặc tiêu đề của mục) để trang tô sáng và tự cuộn theo.
 *  - `podcast`: hai người dẫn trò chuyện theo lượt; không gắn với mục nào của trang.
 */

export const NARRATION_KINDS = ["lecture", "podcast"] as const;
export type NarrationKind = (typeof NARRATION_KINDS)[number];

export const LECTURE_INTRO_ANCHOR = "mo-dau";
export const LECTURE_OUTRO_ANCHOR = "tong-ket";

/** Giới hạn mềm để một kịch bản hỏng (vd dán nhầm cả giáo trình) không đẻ ra hàng trăm lần gọi TTS. */
const MAX_SEGMENTS = 60;
const MAX_TEXT_CHARS = 8_000;
const MAX_TOTAL_CHARS = 40_000;

const LectureSegment = z.object({
  anchor: z.string().min(1).max(300),
  text: z.string().min(1).max(MAX_TEXT_CHARS),
});

export const LectureScript = z
  .array(LectureSegment)
  .min(1)
  .max(MAX_SEGMENTS)
  .refine((segs) => segs.reduce((n, s) => n + s.text.length, 0) <= MAX_TOTAL_CHARS, "lecture_too_long")
  .refine((segs) => new Set(segs.map((s) => s.anchor)).size === segs.length, "lecture_duplicate_anchor")
  // `[en: …]` sai cú pháp bị từ chối ngay lúc lưu, thay vì tạo giọng xong mới đọc nguyên cả chuỗi thẻ.
  .refine((segs) => segs.every((s) => !hasEnglishMarkup(s.text) || englishMarkupOk(s.text)), "lecture_bad_english_markup");
export type LectureScript = z.infer<typeof LectureScript>;

const HostKey = z.enum(["A", "B"]);

export const PodcastScript = z
  .object({
    title: z.string().min(1).max(300),
    durationMin: z.number().int().min(1).max(60).optional(),
    hosts: z.object({ A: z.string().min(1).max(60), B: z.string().min(1).max(60) }),
    turns: z
      .array(z.object({ speaker: HostKey, text: z.string().min(1).max(MAX_TEXT_CHARS) }))
      .min(2)
      .max(200),
  })
  .refine((p) => p.turns.reduce((n, t) => n + t.text.length, 0) <= MAX_TOTAL_CHARS, "podcast_too_long");
export type PodcastScript = z.infer<typeof PodcastScript>;

export function parseScript(kind: NarrationKind, raw: unknown): LectureScript | PodcastScript {
  return kind === "lecture" ? LectureScript.parse(raw) : PodcastScript.parse(raw);
}

/** Băm ổn định của một kịch bản: thứ tự khoá không ảnh hưởng, chỉ nội dung. */
export function scriptHash(script: unknown): string {
  return createHash("sha256").update(canonicalJson(script)).digest("hex").slice(0, 32);
}

function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

// ── Chia đoạn và kế hoạch đọc ────────────────────────────────────────────────

/** Giới hạn ký tự mỗi lần gọi NEU TTS (đo thực tế: 1000 vẫn được, 3000 bị 413 → chừa biên). */
export const TTS_MAX_CHARS = 500;
/** Khoảng lặng sau mỗi mục của lời giảng / mỗi lượt của podcast, tính bằng giây. */
export const PAUSE_AFTER_LECTURE_SEC = 0.5;
export const PAUSE_AFTER_TURN_SEC = 0.3;

/** Chia theo câu rồi gom lại ≤ maxChars; câu quá dài thì cắt ở khoảng trắng. Không bỏ sót chữ nào. */
export function splitForSpeech(text: string, maxChars = TTS_MAX_CHARS): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+(?:[.!?…]+["”')\]]*|$)\s*/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const pieces = sentence.length > maxChars ? cutLong(sentence, maxChars) : [sentence];
    for (const p of pieces) {
      if (!current) current = p;
      else if (current.length + 1 + p.length <= maxChars) current = `${current} ${p}`;
      else {
        flush();
        current = p;
      }
    }
  }
  flush();
  return chunks;
}

function cutLong(sentence: string, maxChars: number): string[] {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut <= 0) cut = maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** `en`: giọng tiếng Anh của lời giảng song ngữ, đọc các đoạn `[en: …]` (docs/tieu-chi/slide-giang-song-ngu.md). */
export type VoiceRole = "lecturer" | "A" | "B" | "en";

/** Một đơn vị của bài (một mục của lời giảng hoặc một lượt thoại) và các lần gọi TTS cần để đọc nó. */
export interface PlannedUnit {
  /** lecture: `anchor`; podcast: chỉ số lượt dạng chuỗi. */
  id: string;
  role: VoiceRole;
  chunks: string[];
  /**
   * Vai của TỪNG đoạn, cùng độ dài `chunks`. Chỉ có khi mục chứa `[en: …]` (hai giọng trong một mục); thiếu thì mọi đoạn
   * dùng `role`, đúng như trước khi có tiếng Anh xen kẽ.
   */
  chunkRoles?: VoiceRole[];
  pauseAfterSec: number;
}

// ── Tiếng Anh xen trong lời giảng: `[en: I had my car repaired]` ────────────────────────────

/** Khoảng lặng giữa hai đoạn khác giọng trong CÙNG một mục lời giảng. Cuối mục vẫn là PAUSE_AFTER_LECTURE_SEC. */
export const PAUSE_BETWEEN_VOICES_SEC = 0.2;

export class EnglishMarkupError extends Error {
  constructor(
    public readonly code: "unclosed" | "empty" | "nested",
    public readonly at: number,
  ) {
    super(`en_markup_${code}@${at}`);
  }
}

export interface SpeechSpan {
  role: "lecturer" | "en";
  text: string;
}

/** Lời giảng có đoạn tiếng Anh không (chưa kiểm tra đúng cú pháp). */
export const hasEnglishMarkup = (text: string): boolean => /\[en\s*:/i.test(text);

/**
 * Tách lời giảng thành các đoạn theo giọng. `[en: …]` không lồng nhau, không rỗng, phải đóng bằng `]`; sai cú pháp thì ném
 * `EnglishMarkupError` (không âm thầm đọc cả chuỗi thẻ). Dấu câu đứng ngay sau thẻ (`[en: …],` `[en: …].`) thuộc phần
 * giọng giảng viên nên bị bỏ để giọng không đọc một dấu phẩy lẻ loi.
 */
export function parseEnglishSpans(text: string): SpeechSpan[] {
  const spans: SpeechSpan[] = [];
  const re = /\[en\s*:/gi;
  let pos = 0;
  let afterEnglish = false;
  const pushLecturer = (raw: string) => {
    const t = (afterEnglish ? raw.replace(/^\s*[,.;:!?]+/, "") : raw).trim();
    if (t) spans.push({ role: "lecturer", text: t });
  };
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const bodyStart = m.index + m[0].length;
    const close = text.indexOf("]", bodyStart);
    if (close < 0) throw new EnglishMarkupError("unclosed", m.index);
    const body = text.slice(bodyStart, close);
    if (body.includes("[")) throw new EnglishMarkupError("nested", m.index);
    if (!body.trim()) throw new EnglishMarkupError("empty", m.index);
    pushLecturer(text.slice(pos, m.index));
    spans.push({ role: "en", text: body.trim() });
    afterEnglish = true;
    pos = close + 1;
    re.lastIndex = pos;
  }
  pushLecturer(text.slice(pos));
  return spans;
}

function englishMarkupOk(text: string): boolean {
  try {
    parseEnglishSpans(text);
    return true;
  } catch {
    return false;
  }
}

/** Chữ cho người ĐỌC (bản ghi lời): bỏ thẻ, giữ chữ tiếng Anh. */
export const stripEnglishMarkup = (text: string): string => text.replace(/\[en\s*:\s*([^\]]*)\]/gi, "$1");

export function planNarration(kind: NarrationKind, script: LectureScript | PodcastScript): PlannedUnit[] {
  if (kind === "lecture") {
    return (script as LectureScript).map((seg) => {
      // Mục không có tiếng Anh: đúng như trước (không có `chunkRoles`), nên lời giảng cũ không đổi gì.
      if (!hasEnglishMarkup(seg.text)) {
        return { id: seg.anchor, role: "lecturer" as const, chunks: splitForSpeech(seg.text), pauseAfterSec: PAUSE_AFTER_LECTURE_SEC };
      }
      const chunks: string[] = [];
      const chunkRoles: VoiceRole[] = [];
      for (const span of parseEnglishSpans(seg.text)) {
        for (const c of splitForSpeech(span.text)) {
          chunks.push(c);
          chunkRoles.push(span.role === "en" ? "en" : "lecturer");
        }
      }
      return { id: seg.anchor, role: "lecturer" as const, chunks, chunkRoles, pauseAfterSec: PAUSE_AFTER_LECTURE_SEC };
    });
  }
  return (script as PodcastScript).turns.map((t, i) => ({
    id: String(i),
    role: t.speaker,
    chunks: splitForSpeech(t.text),
    pauseAfterSec: PAUSE_AFTER_TURN_SEC,
  }));
}

export function countChunks(units: PlannedUnit[]): number {
  return units.reduce((n, u) => n + u.chunks.length, 0);
}
