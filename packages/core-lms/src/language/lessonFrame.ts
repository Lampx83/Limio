import { prisma, type PrismaClient } from "@feedbackme/db";
import type { CourseProgress } from "../learning/progress";

/**
 * LANG đợt 3a — dữ liệu khung bài học kiểu Language (thanh bài trong Unit, bài kế tiếp). Chỉ ĐỌC và chỉ dùng nguồn
 * `getCourseProgress` (đã lọc bài/module ẩn) nên số "x / y bài" luôn khớp trang khoá.
 */

export type RailState = "done" | "current" | "todo" | "locked";

export interface LessonRailItem {
  id: string;
  title: string;
  /** Chỉ có khi bài khai báo thời lượng; không ước đại. */
  minutes: number | null;
  state: RailState;
}

export interface LessonFrameData {
  unitTitle: string;
  unitDone: number;
  unitTotal: number;
  items: LessonRailItem[];
  /** Bài kế tiếp mở được (bỏ qua bài khoá) trong thứ tự khoá; null = đã hết. */
  next: { id: string; title: string } | null;
}

export function minutesOf(durationSec: number | null | undefined): number | null {
  return durationSec && durationSec > 0 ? Math.max(1, Math.ceil(durationSec / 60)) : null;
}

/**
 * Hàm thuần. `durations`: bài → số giây (thiếu hoặc null = không có). Trả null khi bài không nằm trong tiến độ
 * (module ẩn, bài ẩn): khi đó giao diện giữ bố cục thường.
 */
export function buildLessonFrame(
  progress: CourseProgress,
  currentLessonId: string,
  durations: Map<string, number | null>,
): LessonFrameData | null {
  const unit = progress.modules.find((m) => m.lessons.some((l) => l.id === currentLessonId));
  if (!unit) return null;

  const items: LessonRailItem[] = unit.lessons.map((l) => ({
    id: l.id,
    title: l.title,
    minutes: minutesOf(durations.get(l.id)),
    state: l.id === currentLessonId ? "current" : l.locked ? "locked" : l.completed ? "done" : "todo",
  }));

  const flat = progress.modules.flatMap((m) => m.lessons);
  const at = flat.findIndex((l) => l.id === currentLessonId);
  const nextLesson = flat.slice(at + 1).find((l) => !l.locked) ?? null;

  return {
    unitTitle: unit.title,
    unitDone: unit.lessons.filter((l) => l.completed).length,
    unitTotal: unit.lessons.length,
    items,
    next: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null,
  };
}

/** Thời lượng khai báo (giây) của các bài; chỉ trường cần cho thanh bài. */
export async function loadLessonDurations(lessonIds: string[], db: PrismaClient = prisma): Promise<Map<string, number | null>> {
  if (lessonIds.length === 0) return new Map();
  const rows = await db.lesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, durationSec: true } });
  return new Map(rows.map((r) => [r.id, r.durationSec]));
}
