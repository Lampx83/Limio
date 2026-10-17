import {
  OUTLINE_BOX_KINDS,
  OUTLINE_LIMITS,
  isLessonLayoutKey,
  type LessonOutline,
  type OutlineBoxKind,
  type OutlineLesson,
  type OutlineSection,
  type SourcePara,
} from "@feedbackme/shared-types";

/**
 * Làm sạch và kiểm tra dàn ý "tạo bài từ tài liệu". Không tin dàn ý từ AI
 * (normalizeLessonOutline) lẫn từ trình duyệt (sanitizeLessonOutline): mọi
 * đường ghi dàn ý vào DB đều đi qua một trong hai hàm này. Hàm thuần.
 */

/** Đầu vào thô từ mô hình (xem core-feedback generateLessonOutline). */
export interface RawOutlineInput {
  lessons: Array<{
    title?: unknown;
    objectives?: unknown;
    sections?: Array<{ title?: unknown; layout?: unknown; points?: unknown; boxes?: unknown; paras?: unknown }> | unknown;
  }>;
}

export function newOutlineId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(EMOJI, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function texts(v: unknown, maxItems: number, maxLen: number): string[] {
  return Array.isArray(v) ? v.map((x) => text(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];
}

function boxesOf(v: unknown): OutlineBoxKind[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is OutlineBoxKind => (OUTLINE_BOX_KINDS as readonly unknown[]).includes(x)))];
}

function idOf(v: unknown): string {
  return typeof v === "string" && /^[a-z0-9_-]{1,40}$/i.test(v) ? v : newOutlineId();
}

/**
 * Chỉ số đoạn hợp lệ, chưa ai nhận (mỗi đoạn thuộc tối đa một mục — mục
 * đứng trước được ưu tiên), xếp theo thứ tự tài liệu.
 */
function claimParas(v: unknown, paraCount: number, taken: Set<number>): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) {
    const n = typeof x === "number" ? x : Number.NaN;
    if (!Number.isInteger(n) || n < 0 || n >= paraCount || taken.has(n)) continue;
    taken.add(n);
    out.push(n);
  }
  return out.sort((a, b) => a - b);
}

function section(raw: Record<string, unknown>, paraCount: number, taken: Set<number>, keepId: boolean): OutlineSection {
  return {
    id: keepId ? idOf(raw.id) : newOutlineId(),
    title: text(raw.title, OUTLINE_LIMITS.titleMax),
    layout: isLessonLayoutKey(raw.layout) ? raw.layout : "text",
    points: texts(raw.points, OUTLINE_LIMITS.maxPoints, OUTLINE_LIMITS.pointMax),
    boxes: boxesOf(raw.boxes),
    paras: claimParas(raw.paras, paraCount, taken),
  };
}

function lessonsOf(raw: unknown, paraCount: number, taken: Set<number>, keepId: boolean): OutlineLesson[] {
  if (!Array.isArray(raw)) return [];
  const out: OutlineLesson[] = [];
  for (const l of raw.slice(0, OUTLINE_LIMITS.maxLessons)) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    const secs = Array.isArray(o.sections) ? o.sections : [];
    const sections = secs
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .slice(0, OUTLINE_LIMITS.maxSectionsPerLesson)
      .map((s) => section(s, paraCount, taken, keepId));
    if (sections.length === 0) continue;
    out.push({
      id: keepId ? idOf(o.id) : newOutlineId(),
      title: text(o.title, OUTLINE_LIMITS.titleMax),
      objectives: texts(o.objectives, OUTLINE_LIMITS.maxObjectives, OUTLINE_LIMITS.pointMax),
      sections,
    });
  }
  return out;
}

/** Dàn ý AI đề xuất → dàn ý hợp lệ. Bài không còn mục nào bị bỏ. */
export function normalizeLessonOutline(raw: RawOutlineInput, paraCount: number): LessonOutline {
  const taken = new Set<number>();
  const lessons = lessonsOf(raw?.lessons, paraCount, taken, false);
  for (const l of lessons) {
    if (!l.title) l.title = l.sections[0]?.title ?? "Bài học";
    for (const s of l.sections) if (!s.title) s.title = "Mục chưa đặt tên";
  }
  return { lessons, ignoredParas: [] };
}

/**
 * Dàn ý giảng viên gửi lên khi sửa → dàn ý hợp lệ, giữ nguyên id. Tiêu đề
 * trống được giữ (đang gõ dở) — outlineProblems sẽ chặn chốt. Trả null nếu
 * hình dạng sai hẳn.
 */
export function sanitizeLessonOutline(input: unknown, paraCount: number): LessonOutline | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (!Array.isArray(o.lessons)) return null;
  const taken = new Set<number>();
  const lessons = lessonsOf(o.lessons, paraCount, taken, true);
  if (lessons.length === 0) return null;
  const ignoredParas = claimParas(o.ignoredParas, paraCount, taken);
  return { lessons, ignoredParas };
}

/** Đoạn có nội dung mà chưa thuộc mục nào và chưa được bỏ qua (D4). */
export function orphanParas(outline: LessonOutline, paras: SourcePara[]): number[] {
  const used = new Set<number>(outline.ignoredParas);
  for (const l of outline.lessons) for (const s of l.sections) for (const n of s.paras) used.add(n);
  const out: number[] = [];
  paras.forEach((p, i) => {
    if (used.has(i)) return;
    if ("t" in p && !p.t.trim()) return;
    out.push(i);
  });
  return out;
}

function words(p: SourcePara | undefined): number {
  return p && "t" in p ? p.t.split(/\s+/).filter(Boolean).length : 0;
}

/** Phút đọc ước lượng của một bài, theo các đoạn tài liệu thuộc bài (200 từ/phút). */
export function lessonReadingMinutes(lesson: OutlineLesson, paras: SourcePara[]): number {
  let w = 0;
  for (const s of lesson.sections) for (const n of s.paras) w += words(paras[n]);
  return Math.max(1, Math.round(w / 200));
}

/** Bài quá dài so với ngưỡng gợi ý tách (D5) — chỉ để nhắc, không chặn. */
export function shouldSuggestSplit(lesson: OutlineLesson, paras: SourcePara[]): boolean {
  return (
    lesson.sections.length > OUTLINE_LIMITS.splitSuggestSections ||
    lessonReadingMinutes(lesson, paras) > OUTLINE_LIMITS.splitSuggestMinutes
  );
}

/** Lỗi phải sửa trước khi chốt dàn ý (D7). Rỗng = chốt được. */
export function outlineProblems(outline: LessonOutline, paras: SourcePara[]): string[] {
  const out: string[] = [];
  const sectionCount = outline.lessons.reduce((n, l) => n + l.sections.length, 0);
  if (sectionCount === 0) out.push("Dàn ý chưa có mục nào.");
  outline.lessons.forEach((l, i) => {
    const name = outline.lessons.length > 1 ? `Bài ${i + 1}` : "Bài học";
    if (!l.title.trim()) out.push(`${name} chưa có tên.`);
    const blank = l.sections.filter((s) => !s.title.trim()).length;
    if (blank) out.push(`${name} có ${blank} mục chưa có tiêu đề.`);
  });
  const orphans = orphanParas(outline, paras).length;
  if (orphans) out.push(`${orphans} đoạn tài liệu chưa thuộc mục nào — gán vào một mục hoặc bỏ qua.`);
  return out;
}

/** Bỏ các bài không còn mục nào (sau khi kéo hết mục sang bài khác), giữ ít nhất một bài. */
export function pruneEmptyLessons(outline: LessonOutline): LessonOutline {
  const lessons = outline.lessons.filter((l) => l.sections.length > 0);
  return { ...outline, lessons: lessons.length ? lessons : outline.lessons.slice(0, 1) };
}
