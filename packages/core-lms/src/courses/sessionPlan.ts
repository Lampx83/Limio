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
  /** Số buổi của chương giáo án (theo giáo trình); null khi buổi dùng kế hoạch riêng và không có chương cùng số. */
  sessionNo: number | null;
  moduleId: string | null;
  /** Tên giáo án: tên chương (theo giáo trình) hoặc chủ đề do giáo viên đặt; null khi kế hoạch riêng chưa có chủ đề. */
  title: string | null;
  lessons: PlanLesson[];
  /** CENTER J — true = danh sách bài do giáo viên tự chọn cho riêng buổi này. */
  customized: boolean;
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
    byNo.set(m.sessionNo!, { courseSlug: m.course.slug, sessionNo: m.sessionNo!, moduleId: m.id, title: m.title, lessons: m.lessons, customized: false });
    out.set(m.courseId, byNo);
  }
  return out;
}

export interface PlanMeetingRef {
  id: string;
  seq: number | null;
  status: "planned" | "held" | "cancelled";
  courseId: string;
  planCustomized: boolean;
  planTopic: string | null;
}

/**
 * CENTER J — kế hoạch HIỆU LỰC của từng buổi: danh sách riêng nếu giáo viên đã tuỳ chỉnh (kể cả rỗng), nếu không thì
 * chương giáo trình cùng số buổi. Buổi huỷ và buổi chưa tuỳ chỉnh mà không có chương cùng số thì không có kế hoạch
 * (không có mặt trong kết quả). Học viên không thấy bài/chương ẩn.
 */
export async function resolveMeetingPlans(
  meetings: readonly PlanMeetingRef[],
  audience: PlanAudience,
  db: DbClient = prisma,
): Promise<Map<string, MeetingPlan>> {
  const out = new Map<string, MeetingPlan>();
  const live = meetings.filter((m) => m.status !== "cancelled");
  if (live.length === 0) return out;

  const chapters = await loadSessionPlans(live.map((m) => m.courseId), audience, db);
  const custom = live.filter((m) => m.planCustomized);
  const learner = audience === "learner";

  const rows = custom.length
    ? await db.classMeetingLesson.findMany({
        where: { meetingId: { in: custom.map((m) => m.id) } },
        orderBy: [{ meetingId: "asc" }, { orderIndex: "asc" }],
        select: { meetingId: true, lesson: { select: { id: true, title: true, isHidden: true, module: { select: { isHidden: true } } } } },
      })
    : [];
  const slugs = custom.length
    ? new Map((await db.course.findMany({ where: { id: { in: [...new Set(custom.map((m) => m.courseId))] } }, select: { id: true, slug: true } })).map((c) => [c.id, c.slug]))
    : new Map<string, string>();

  for (const m of live) {
    if (m.planCustomized) {
      const lessons = rows
        .filter((r) => r.meetingId === m.id && !(learner && (r.lesson.isHidden || r.lesson.module.isHidden)))
        .map((r) => ({ id: r.lesson.id, title: r.lesson.title }));
      out.set(m.id, { courseSlug: slugs.get(m.courseId) ?? "", sessionNo: null, moduleId: null, title: m.planTopic, lessons, customized: true });
    } else if (m.seq !== null) {
      const plan = chapters.get(m.courseId)?.get(m.seq);
      if (plan) out.set(m.id, plan);
    }
  }
  return out;
}

export type { PrismaClient };
