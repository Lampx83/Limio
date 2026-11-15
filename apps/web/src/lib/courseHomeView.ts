/**
 * Chữ hiển thị ở trang khoá học của học viên (lộ trình), tách ra để kiểm thử được.
 *
 * Sinh viên Thực hành 1 chỉ ra những chỗ đọc là không hiểu:
 *  - "Level 1 · Newcomer — +140 → L2": tiếng Anh, có mũi tên và dấu cộng.
 *  - Nút "Tiếp tục bài gần nhất" không nói bài nào.
 *  - Bảng xếp hạng cho thấy hạng của mình nhưng không nói còn cách hạng trên bao nhiêu.
 *
 * Mọi hàm có chữ hiển thị nhận thêm `lang` (mặc định "vi" — kết quả y như trước).
 */

import type { UiLang } from "@/lib/i18n/core";
import { tFor } from "@/lib/i18n/tFor";

const LEVEL_NAME_VI: Record<string, string> = {
  Newcomer: "Người mới",
  Engaged: "Chăm chỉ",
  Dedicated: "Tận tâm",
  Expert: "Thành thạo",
  Master: "Bậc thầy",
};

/** Tên cấp bằng tiếng Việt; tên lạ (do cấu hình thêm sau) thì giữ nguyên. */
export function levelNameVi(name: string, lang: UiLang = "vi"): string {
  if (lang === "en") return name; // tên cấp gốc trong cấu hình XP vốn là tiếng Anh
  return LEVEL_NAME_VI[name] ?? name;
}

interface LevelInput {
  level: number;
  levelName: string;
  xpToNext: number | null;
  isMaxLevel: boolean;
}

/** Tách dòng mô tả cấp thành phần chính (luôn hiện) và phần "cần thêm … XP" (màn hẹp có thể ẩn). */
export function describeLevelParts(input: LevelInput, lang: UiLang = "vi"): { head: string; more: string | null } {
  const t = tFor(lang);
  const head = t("learn.view.levelHead", { level: input.level, name: levelNameVi(input.levelName, lang) });
  if (input.isMaxLevel) return { head: t("learn.view.levelMax", { head }), more: null };
  if (input.xpToNext === null) return { head, more: null };
  return { head, more: t("learn.view.levelMore", { xp: input.xpToNext, next: input.level + 1 }) };
}

export function describeLevel(input: LevelInput, lang: UiLang = "vi"): string {
  const { head, more } = describeLevelParts(input, lang);
  return more ? `${head}. ${more}` : head;
}

export interface LessonProgressItem {
  id: string;
  title: string;
  completed: boolean;
  locked: boolean;
}

/**
 * Bài mà nút "Tiếp tục" trỏ tới — và cũng là bài được đánh dấu trong danh sách, để hai chỗ không bao giờ
 * nói khác nhau. Bài mở gần nhất còn dở thì là bài đó ("Đang học"); đã xong thì là bài chưa học đầu tiên
 * ("Bài tiếp theo"). Trước đây nút cứ trỏ về bài mở gần nhất, nên học xong Bài 1.1 vẫn thấy
 * "Tiếp tục: Bài 1.1" ngay trên dòng "Bài 1.2 · Bài tiếp theo".
 * `lessons` theo thứ tự khoá. Học xong cả khoá thì quay về bài gần nhất (để ôn); null nếu chưa có gì.
 */
export function pickContinueLesson(
  lastLessonId: string | null,
  lessons: LessonProgressItem[],
): { id: string; title: string; kind: "current" | "next" } | null {
  const last = lastLessonId ? lessons.find((l) => l.id === lastLessonId) : undefined;
  if (last && !last.completed) return { id: last.id, title: last.title, kind: "current" };
  const next = lessons.find((l) => !l.completed && !l.locked);
  if (next) return { id: next.id, title: next.title, kind: "next" };
  return last ? { id: last.id, title: last.title, kind: "current" } : null;
}

/** Nhãn nút vào học: nói rõ bài nào. `title` rỗng thì quay về câu chung. */
export function continueButtonText(kind: "continue" | "start", title: string | null, lang: UiLang = "vi"): string {
  const t = tFor(lang);
  const verb = kind === "continue" ? t("learn.view.continue") : t("learn.view.start");
  return title
    ? t("learn.view.verbTitle", { verb, title })
    : kind === "continue"
      ? t("learn.view.continueLast")
      : t("learn.view.startLearning");
}

export function streakLabel(days: number, lang: UiLang = "vi"): string {
  return tFor(lang)("learn.view.streak", { n: days });
}

/**
 * Khoảng cách XP tới người ngay trên mình. Chỉ tính được khi người đó nằm trong
 * danh sách đang hiện; null nếu mình đứng đầu, hoặc không có dữ liệu để so.
 */
export function gapToNextRank(input: {
  entries: Array<{ rank: number; xp: number }>;
  me: { rank: number; xp: number } | null;
}): { aboveRank: number; gapXp: number } | null {
  const { entries, me } = input;
  if (!me || me.rank <= 1) return null;
  const above = entries.find((e) => e.rank === me.rank - 1);
  if (!above) return null;
  return { aboveRank: above.rank, gapXp: Math.max(0, above.xp - me.xp) };
}

export function gapText(gap: { aboveRank: number; gapXp: number }, lang: UiLang = "vi"): string {
  const t = tFor(lang);
  if (gap.gapXp === 0) return t("learn.view.gapEven", { rank: gap.aboveRank });
  return t("learn.view.gap", { rank: gap.aboveRank, xp: gap.gapXp.toLocaleString(lang === "en" ? "en-US" : "vi-VN") });
}

// ── Thẻ cột phải của trang khoá ngoại ngữ (docs/tieu-chi/trang-khoa-hoc-cot-phai-theo-figma.md) ──

/** Thứ tự dòng của thẻ "Tiến độ theo kỹ năng" theo Figma: Đọc, Nghe, Nói, Viết. */
const SKILL_CARD_ORDER = ["reading", "listening", "speaking", "writing"] as const;

export interface SkillProgressRow {
  skill: string;
  label: string;
  /** Số bài đã luyện / tổng bài, làm tròn 0–100; null khi kỹ năng chưa có bài nào. KHÔNG phải mastery. */
  pct: number | null;
}

export function skillProgressRows(
  skills: Array<{ skill: string; lessonsTotal: number; lessonsPracticed: number }>,
  lang: UiLang = "vi",
): SkillProgressRow[] {
  const t = tFor(lang);
  return SKILL_CARD_ORDER.map((k) => {
    const row = skills.find((s) => s.skill === k);
    const total = row?.lessonsTotal ?? 0;
    const pct = total > 0 ? Math.min(100, Math.round(((row?.lessonsPracticed ?? 0) / total) * 100)) : null;
    return { skill: k, label: t(`learn.view.skill.${k}`), pct };
  });
}

export interface ReviewCardView {
  done: boolean;
  /** "n từ vựng" khi còn thẻ đến hạn; câu "Hôm nay bạn đã ôn xong." khi hết. */
  headline: string;
  /** "Từ <tên bài>" khi có gợi ý bài nên ôn, không thì null (không hiện dòng). */
  fromLine: string | null;
  buttonLabel: string;
}

export function reviewCardView(input: { reviewable: number; suggestionLessonTitle?: string | null }, lang: UiLang = "vi"): ReviewCardView {
  const t = tFor(lang);
  const title = input.suggestionLessonTitle?.trim();
  const fromLine = title ? t("learn.view.review.from", { title }) : null;
  if (input.reviewable > 0) {
    return { done: false, headline: t("learn.view.review.words", { n: input.reviewable }), fromLine, buttonLabel: t("learn.view.review.button") };
  }
  return { done: true, headline: t("learn.view.review.doneHeadline"), fromLine: null, buttonLabel: t("learn.view.review.doneButton") };
}

// ── Thẻ đề: hai cột "Thi thử" và "Luyện đề" (AC6 của docs/tieu-chi/trang-khoa-hoc-cot-phai-theo-figma.md) ──

/** Dòng trạng thái của cột Thi thử (lượt thi `ExamAttempt`). */
export function mockStatusText(
  o: {
    attempt: { status: string; scorePct: number | null } | null;
    attemptCount: number;
  },
  lang: UiLang = "vi",
): string {
  const t = tFor(lang);
  const a = o.attempt;
  if (!a) return t("learn.view.mock.none");
  if (a.status === "in_progress") return t("learn.view.mock.inProgress", { n: o.attemptCount });
  return a.scorePct != null
    ? t("learn.view.mock.takenLatest", { n: o.attemptCount, pct: Math.round(a.scorePct) })
    : t("learn.view.mock.taken", { n: o.attemptCount });
}

export interface PracticeState {
  inProgress: { sessionId: string; answered: number; total: number } | null;
  completedCount: number;
}

/** Dòng trạng thái của cột Luyện đề. Không có điểm hay %: luyện đề không phải điểm số. */
export function practiceStatusText(p: PracticeState, lang: UiLang = "vi"): string {
  const t = tFor(lang);
  if (p.inProgress) return t("learn.view.practice.inProgress", { answered: p.inProgress.answered, total: p.inProgress.total });
  if (p.completedCount > 0) return t("learn.view.practice.done", { n: p.completedCount });
  return t("learn.view.practice.none");
}

export function practiceButtonLabel(p: PracticeState, lang: UiLang = "vi"): string {
  const t = tFor(lang);
  return p.inProgress ? t("learn.view.practice.continue") : t("learn.view.practice.start");
}

/** Đích của nút Luyện đề: có buổi dở thì vào thẳng buổi đó, không thì sang trang chọn phạm vi. */
export function practiceHref(slug: string, examId: string, p: PracticeState): string {
  return p.inProgress
    ? `/learn/${slug}/exams/${examId}/practice/${p.inProgress.sessionId}`
    : `/learn/${slug}/exams/${examId}/practice`;
}
