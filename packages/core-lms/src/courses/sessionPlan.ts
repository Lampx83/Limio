/**
 * Giáo án theo buổi (CENTER C3): chương có `sessionNo = N` là giáo án của buổi học số N trong khoá.
 *
 * Buổi học của lớp có `seq` (số thứ tự theo thời gian trong các buổi không huỷ — xem classSchedule.ts),
 * nên huỷ hay dạy bù không làm lệch giáo án: buổi nào đang mang số N thì dạy chương N.
 * Học viên chỉ nhận id và tên bài (không bao giờ nội dung), và không thấy chương/bài đã ẩn.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";

export interface PlanLesson {
  id: string;
  title: string;
}

export interface MeetingPlan {
  /** Slug khoá, để dựng liên kết mở bài (`/learn/<slug>/lessons/<id>`). */
  courseSlug: string;
  sessionNo: number;
  moduleId: string;
  title: string;
  lessons: PlanLesson[];
}

export type PlanAudience = "teacher" | "learner";

/** courseId → (sessionNo → giáo án). Khoá không có chương nào gắn buổi thì không có mặt trong map. */
export async function loadSessionPlans(
  courseIds: readonly string[],
  audience: PlanAudience,
  db: DbClient = prisma,
): Promise<Map<string, Map<number, MeetingPlan>>> {
  const out = new Map<string, Map<number, MeetingPlan>>();
  if (courseIds.length === 0) return out;
  const learner = audience === "learner";
  const modules = await db.module.findMany({
    where: { courseId: { in: [...new Set(courseIds)] }, sessionNo: { not: null }, ...(learner ? { isHidden: false } : {}) },
    orderBy: [{ courseId: "asc" }, { sessionNo: "asc" }],
    select: {
      id: true,
      courseId: true,
      title: true,
      sessionNo: true,
      course: { select: { slug: true } },
      lessons: {
        where: learner ? { isHidden: false } : undefined,
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true },
      },
    },
  });
  for (const m of modules) {
    const byNo = out.get(m.courseId) ?? new Map<number, MeetingPlan>();
    byNo.set(m.sessionNo!, { courseSlug: m.course.slug, sessionNo: m.sessionNo!, moduleId: m.id, title: m.title, lessons: m.lessons });
    out.set(m.courseId, byNo);
  }
  return out;
}

export type { PrismaClient };
