import { prisma, type PrismaClient } from "@feedbackme/db";
import type { LanguageSkill } from "@feedbackme/shared-types";
import { getCourseProgress, type CourseProgress } from "../learning/progress";

/**
 * LANG đợt 1 — số liệu cho trang "Lộ trình của tôi" của vỏ Limio Language. Chỉ ĐỌC dữ liệu của chính người xem
 * (ghi danh `active` của họ). Không đọc `LearnerSkillState`: tiến độ theo kỹ năng ở đây là bài đã hoàn thành, không
 * phải mức nắm vững, nên không có số mastery nào đi qua đây (CLAUDE.md §5.4).
 */

/** Thứ tự hiển thị theo thiết kế: Đọc, Nghe, Nói, Viết. */
const SKILL_ORDER: LanguageSkill[] = ["reading", "listening", "speaking", "writing"];

export type UnitState = "done" | "learning" | "todo";

export interface LanguagePathCourse {
  id: string;
  slug: string;
  title: string;
}

export interface LanguagePathUnit {
  id: string;
  title: string;
  done: number;
  total: number;
  state: UnitState;
}

export interface LanguagePathSkill {
  skill: LanguageSkill;
  done: number;
  total: number;
  pct: number;
}

export interface LanguagePathContinue {
  lessonId: string;
  lessonTitle: string;
  unitTitle: string;
  /** Chỉ có khi bài khai báo thời lượng; không ước đại. */
  minutes: number | null;
}

export interface LanguageLearnerPath {
  /** Mọi khoá ngoại ngữ đang học (cho ô chọn khoá), mới ghi danh nhất trước. */
  courses: LanguagePathCourse[];
  /** null khi chưa ghi danh khoá ngoại ngữ nào. */
  selected: (LanguagePathCourse & { completionPct: number }) | null;
  continue: LanguagePathContinue | null;
  units: LanguagePathUnit[];
  skills: LanguagePathSkill[];
}

export function unitState(done: number, total: number): UnitState {
  if (total > 0 && done >= total) return "done";
  return done > 0 ? "learning" : "todo";
}

/**
 * Hàm thuần: từ tiến độ khoá (đã lọc bài/module ẩn) + kỹ năng và thời lượng của từng bài → các khối của trang.
 * Module không có bài nào bị bỏ (không có gì để học).
 */
export function buildLanguagePath(
  progress: CourseProgress,
  lessonMeta: Map<string, { skill: LanguageSkill | null; durationSec: number | null }>,
  lastLessonId: string | null,
): Pick<LanguageLearnerPath, "continue" | "units" | "skills"> {
  const units: LanguagePathUnit[] = [];
  const skillTotals = new Map<LanguageSkill, { done: number; total: number }>();
  const ordered: Array<{ id: string; title: string; unitTitle: string; completed: boolean; locked: boolean }> = [];

  for (const m of progress.modules) {
    if (m.lessons.length === 0) continue;
    const done = m.lessons.filter((l) => l.completed).length;
    units.push({ id: m.id, title: m.title, done, total: m.lessons.length, state: unitState(done, m.lessons.length) });
    for (const l of m.lessons) {
      ordered.push({ id: l.id, title: l.title, unitTitle: m.title, completed: l.completed, locked: l.locked });
      const skill = lessonMeta.get(l.id)?.skill ?? null;
      if (!skill) continue;
      const t = skillTotals.get(skill) ?? { done: 0, total: 0 };
      t.total += 1;
      if (l.completed) t.done += 1;
      skillTotals.set(skill, t);
    }
  }

  const skills: LanguagePathSkill[] = SKILL_ORDER.flatMap((skill) => {
    const t = skillTotals.get(skill);
    return t && t.total > 0 ? [{ skill, done: t.done, total: t.total, pct: Math.round((t.done / t.total) * 100) }] : [];
  });

  // Bài "tiếp tục": bài mở gần nhất nếu còn hiển thị, chưa hoàn thành và không khoá; không thì bài chưa hoàn thành
  // đầu tiên theo thứ tự.
  const resume = lastLessonId ? ordered.find((l) => l.id === lastLessonId && !l.completed && !l.locked) : undefined;
  const target = resume ?? ordered.find((l) => !l.completed && !l.locked);
  const durationSec = target ? (lessonMeta.get(target.id)?.durationSec ?? null) : null;
  return {
    units,
    skills,
    continue: target
      ? {
          lessonId: target.id,
          lessonTitle: target.title,
          unitTitle: target.unitTitle,
          minutes: durationSec && durationSec > 0 ? Math.max(1, Math.ceil(durationSec / 60)) : null,
        }
      : null,
  };
}

/**
 * Trang "Lộ trình của tôi". `courseSlug` chỉ được nhận nếu là khoá ngoại ngữ MÀ NGƯỜI XEM đang học; slug khác bị
 * bỏ qua (rơi về khoá mặc định) nên không lộ khoá của người khác.
 */
export async function getLanguageLearnerPath(
  userId: string,
  courseSlug: string | null,
  db: PrismaClient = prisma,
): Promise<LanguageLearnerPath> {
  const enr = await db.enrollment.findMany({
    where: { userId, status: "active", course: { languageMode: true, status: "published" } },
    orderBy: { enrolledAt: "desc" },
    select: { lastLessonId: true, course: { select: { id: true, slug: true, title: true } } },
  });
  if (enr.length === 0) return { courses: [], selected: null, continue: null, units: [], skills: [] };

  const chosen =
    (courseSlug ? enr.find((e) => e.course.slug === courseSlug) : undefined) ??
    enr.find((e) => e.lastLessonId) ??
    enr[0]!;

  const progress = await getCourseProgress(userId, chosen.course.id, db);
  const lessonIds = progress.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const rows = lessonIds.length
    ? await db.lesson.findMany({
        where: { id: { in: lessonIds } },
        select: { id: true, languageSkill: true, durationSec: true },
      })
    : [];
  const meta = new Map(rows.map((r) => [r.id, { skill: r.languageSkill as LanguageSkill | null, durationSec: r.durationSec }]));

  return {
    courses: enr.map((e) => ({ id: e.course.id, slug: e.course.slug, title: e.course.title })),
    selected: { ...chosen.course, completionPct: progress.courseCompletionPct },
    ...buildLanguagePath(progress, meta, chosen.lastLessonId),
  };
}

/** Học viên có khoá ngoại ngữ nào đang học không — quyết định có hiện lối "Limio Language" ở vỏ thường. */
export async function learnerHasLanguageCourses(userId: string, db: PrismaClient = prisma): Promise<boolean> {
  const row = await db.enrollment.findFirst({
    where: { userId, status: "active", course: { languageMode: true } },
    select: { id: true },
  });
  return !!row;
}
