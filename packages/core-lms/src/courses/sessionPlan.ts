/**
 * Giáo án theo buổi. Thứ tự ưu tiên của một buổi:
 *   1. kế hoạch riêng của buổi (CENTER J, `ClassMeetingLesson`);
 *   2. bảng phân phối chương trình của khoá (CENTER K, `CourseSession`): buổi số N học các bài của dòng N;
 *   3. chương có `sessionNo = N` (CENTER C3) — CHỈ khi khoá chưa có dòng phân phối nào.
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

/**
 * courseId → (sessionNo → giáo án mặc định của buổi số N). Khoá có bảng phân phối (CENTER K) thì chỉ lấy từ bảng, kể cả
 * buổi không có bài; khoá chưa có bảng thì lấy chương `sessionNo`. Khoá không có gì thì không có mặt trong map.
 */
export async function loadSessionPlans(
  courseIds: readonly string[],
  audience: PlanAudience,
  db: DbClient = prisma,
): Promise<Map<string, Map<number, MeetingPlan>>> {
  const out = new Map<string, Map<number, MeetingPlan>>();
  const ids = [...new Set(courseIds)];
  if (ids.length === 0) return out;
  const learner = audience === "learner";

  const planned = await db.courseSession.findMany({
    where: { courseId: { in: ids } },
    orderBy: [{ courseId: "asc" }, { sessionNo: "asc" }],
    select: {
      courseId: true,
      sessionNo: true,
      topic: true,
      course: { select: { slug: true } },
      lessons: {
        orderBy: { orderIndex: "asc" },
        select: { lesson: { select: { id: true, title: true, isHidden: true, module: { select: { isHidden: true } } } } },
      },
    },
  });
  for (const p of planned) {
    const byNo = out.get(p.courseId) ?? new Map<number, MeetingPlan>();
    const lessons = p.lessons
      .filter((r) => !(learner && (r.lesson.isHidden || r.lesson.module.isHidden)))
      .map((r) => ({ id: r.lesson.id, title: r.lesson.title }));
    byNo.set(p.sessionNo, { courseSlug: p.course.slug, sessionNo: p.sessionNo, moduleId: null, title: p.topic, lessons, customized: false });
    out.set(p.courseId, byNo);
  }

  const byChapter = ids.filter((id) => !out.has(id));
  if (byChapter.length === 0) return out;
  const modules = await db.module.findMany({
    where: { courseId: { in: byChapter }, sessionNo: { not: null }, ...(learner ? { isHidden: false } : {}) },
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
 * giáo án mặc định cùng số buổi (bảng phân phối của khoá, hoặc chương — xem loadSessionPlans). Buổi huỷ và buổi chưa tuỳ chỉnh mà không có chương cùng số thì không có kế hoạch
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
