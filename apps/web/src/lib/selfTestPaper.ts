/**
 * Mini-test cuối bài mô phỏng đề HSK (docs/tieu-chi/mini-test-cuoi-bai.md, "Mô phỏng đề thi"): chia phần 听力 / 阅读 / 书写, mỗi phần có
 * câu hướng dẫn bằng chữ Hán, phương án đánh A B C D, câu nghe chỉ phát một lần. Dữ liệu nằm ở `QuizQuestion.extra`:
 *   extra.section   = { key: "listening" | "reading" | "writing", label: "听力 · Nghe", part?: "第一部分", intro?: "第1-6题：…" }
 *   extra.audioPlays = 1  (số lần được phát audio của câu; trống = nghe lại tự do)
 */
export type PaperSectionKey = "listening" | "reading" | "writing";

export interface PaperSection {
  key: PaperSectionKey;
  label: string;
  part: string | null;
  intro: string | null;
}

const KEYS: PaperSectionKey[] = ["listening", "reading", "writing"];

const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function paperSectionOf(extra: unknown): PaperSection | null {
  const s = (extra as { section?: unknown } | null | undefined)?.section;
  if (!s || typeof s !== "object") return null;
  const { key, label, part, intro } = s as Record<string, unknown>;
  if (typeof key !== "string" || !KEYS.includes(key as PaperSectionKey)) return null;
  const lab = text(label, 60);
  if (!lab) return null;
  return { key: key as PaperSectionKey, label: lab, part: text(part, 40), intro: text(intro, 300) };
}

/** Số lần được phát audio của câu; null = không giới hạn. */
export function audioPlaysOf(extra: unknown): number | null {
  const n = (extra as { audioPlays?: unknown } | null | undefined)?.audioPlays;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Chữ cái phương án kiểu đề HSK: 0 → A, 1 → B… */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

/** Câu bắt đầu một phần (khác phần và khác "phần nhỏ" của câu trước) thì hiện khung hướng dẫn. */
export function startsPart(prev: unknown, cur: unknown): boolean {
  const c = paperSectionOf(cur);
  if (!c) return false;
  const p = paperSectionOf(prev);
  return !p || p.key !== c.key || p.part !== c.part;
}

export interface SectionScore {
  key: PaperSectionKey;
  label: string;
  correct: number;
  total: number;
}

/** Số câu đúng theo phần (thứ tự nghe, đọc, viết); câu không thuộc phần nào bị bỏ qua. */
export function sectionBreakdown(items: Array<{ extra: unknown; isCorrect: boolean }>): SectionScore[] {
  const rows = new Map<PaperSectionKey, SectionScore>();
  for (const it of items) {
    const s = paperSectionOf(it.extra);
    if (!s) continue;
    const row = rows.get(s.key) ?? { key: s.key, label: s.label, correct: 0, total: 0 };
    row.total += 1;
    if (it.isCorrect) row.correct += 1;
    rows.set(s.key, row);
  }
  return KEYS.flatMap((k) => (rows.has(k) ? [rows.get(k)!] : []));
}

export interface SectionOutline {
  key: PaperSectionKey;
  label: string;
  count: number;
  /** Mọi câu nghe của phần chỉ được phát một lần. */
  listenOnce: boolean;
}

/** Cấu trúc đề (phần, số câu, có nghe một lần không) cho màn hướng dẫn trước khi làm. */
export function paperOutline(questions: Array<{ extra: unknown }>): SectionOutline[] {
  const rows = new Map<PaperSectionKey, SectionOutline & { audio: number; once: number }>();
  for (const q of questions) {
    const s = paperSectionOf(q.extra);
    if (!s) continue;
    const row = rows.get(s.key) ?? { key: s.key, label: s.label, count: 0, listenOnce: false, audio: 0, once: 0 };
    row.count += 1;
    const hasAudio = typeof (q.extra as { audioUrl?: unknown } | null)?.audioUrl === "string";
    if (hasAudio) {
      row.audio += 1;
      if (audioPlaysOf(q.extra) === 1) row.once += 1;
    }
    rows.set(s.key, row);
  }
  return KEYS.flatMap((k) => {
    const r = rows.get(k);
    return r ? [{ key: r.key, label: r.label, count: r.count, listenOnce: r.audio > 0 && r.once === r.audio }] : [];
  });
}
