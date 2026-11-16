/**
 * CENTER K — Phân phối chương trình (docs/CENTER-schedule-attendance-AC.md, mục K).
 *
 * Bảng "buổi nào học bài nào" soạn MỘT lần cho cả khoá: buổi số N (chưa tuỳ chỉnh) của mọi lớp học các bài của dòng N.
 * Khoá có bảng thì chỉ dùng bảng; khoá chưa có bảng thì rơi về chương `sessionNo` (C3). Kế hoạch riêng của buổi (J)
 * vẫn thắng. Thứ tự ưu tiên nằm ở sessionPlan.loadSessionPlans/resolveMeetingPlans.
 *
 * Buổi ĐÃ KẾT THÚC không được đổi ngược: trước khi ghi bảng, buổi đã kết thúc còn theo mặc định được chụp giáo án hiện
 * tại thành kế hoạch riêng của buổi đó (tổng kết và nhận xét đã gửi dựa vào nó).
 *
 * Quyền: người quản khoá sửa; người chỉ dạy (vai trò khác trong khoá) xem.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { CourseAuthzError } from "./authz";
import { assertCanManageCourse, getTeachingScope } from "./teachingScope";
import { resolveMeetingPlans } from "./sessionPlan";
import { MEETING_PLAN_MAX_LESSONS, MEETING_PLAN_TOPIC_MAX } from "./meetingPlan";

export const COURSE_PLAN_MAX_SESSIONS = 200;

export class CourseSessionPlanError extends Error {
  constructor(
    public readonly code: "validation_failed" | "lesson_not_in_course" | "too_many_lessons" | "too_many_sessions",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export interface CourseSessionPlanLesson {
  id: string;
  title: string;
  moduleTitle: string;
  /** Bài hoặc chương đang ẩn: giáo viên thấy, học viên không. */
  hidden: boolean;
}

export interface CourseSessionPlanView {
  courseId: string;
  /** `plan` = khoá đã có bảng; `chapters` = đang theo chương số N; `none` = chưa có giáo án theo buổi. */
  source: "plan" | "chapters" | "none";
  editable: boolean;
  sessions: Array<{ sessionNo: number; topic: string | null; lessons: CourseSessionPlanLesson[] }>;
  /** Số bài của khoá (kể cả bài ẩn) chưa nằm trong buổi nào. */
  unplannedLessons: number;
}

const LESSON_SELECT = { id: true, title: true, isHidden: true, module: { select: { title: true, isHidden: true } } } as const;
type LessonRow = { id: string; title: string; isHidden: boolean; module: { title: string; isHidden: boolean } };
const toLesson = (l: LessonRow): CourseSessionPlanLesson => ({ id: l.id, title: l.title, moduleTitle: l.module.title, hidden: l.isHidden || l.module.isHidden });

async function assertCanView(actorUserId: string, courseId: string, db: DbClient): Promise<boolean> {
  const scope = await getTeachingScope(actorUserId, courseId, db);
  if (scope === null) {
    const exists = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
    throw new CourseAuthzError(exists ? "forbidden" : "not_found");
  }
  return scope === "manage";
}

async function buildView(courseId: string, editable: boolean, db: DbClient): Promise<CourseSessionPlanView> {
  const [planned, chapters, allLessons] = await Promise.all([
    db.courseSession.findMany({
      where: { courseId },
      orderBy: { sessionNo: "asc" },
      select: { sessionNo: true, topic: true, lessons: { orderBy: { orderIndex: "asc" }, select: { lesson: { select: LESSON_SELECT } } } },
    }),
    db.module.findMany({
      where: { courseId, sessionNo: { not: null } },
      orderBy: { sessionNo: "asc" },
      select: { sessionNo: true, title: true, isHidden: true, lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, isHidden: true } } },
    }),
    db.lesson.findMany({ where: { module: { courseId } }, select: { id: true } }),
  ]);

  let source: CourseSessionPlanView["source"];
  let sessions: CourseSessionPlanView["sessions"];
  if (planned.length > 0) {
    source = "plan";
    sessions = planned.map((p) => ({ sessionNo: p.sessionNo, topic: p.topic, lessons: p.lessons.map((r) => toLesson(r.lesson)) }));
  } else if (chapters.length > 0) {
    source = "chapters";
    sessions = chapters.map((m) => ({
      sessionNo: m.sessionNo!,
      topic: m.title,
      lessons: m.lessons.map((l) => toLesson({ ...l, module: { title: m.title, isHidden: m.isHidden } })),
    }));
  } else {
    source = "none";
    sessions = [];
  }
  const used = new Set(sessions.flatMap((s) => s.lessons.map((l) => l.id)));
  return { courseId, source, editable, sessions, unplannedLessons: allLessons.filter((l) => !used.has(l.id)).length };
}

/** Xem bảng: người quản khoá (sửa được) hoặc người chỉ dạy (chỉ xem). Khoá chưa có bảng thì trả giáo án theo chương. */
export async function getCourseSessionPlan(actorUserId: string, courseId: string, db: PrismaClient = prisma): Promise<CourseSessionPlanView> {
  const editable = await assertCanView(actorUserId, courseId, db);
  return buildView(courseId, editable, db);
}

const SaveInput = z.object({
  sessions: z
    .array(
      z.object({
        topic: z.string().trim().max(MEETING_PLAN_TOPIC_MAX).nullish(),
        lessonIds: z.array(z.string().min(1)),
      }),
    )
    .min(1),
});

/**
 * Chụp giáo án hiện tại của các buổi ĐÃ KẾT THÚC còn theo mặc định thành kế hoạch riêng, để đổi bảng không viết lại
 * lịch sử. Phải gọi TRƯỚC khi đổi bảng (đọc giáo án mặc định đang có).
 */
async function freezeClosedMeetings(courseId: string, tx: DbClient): Promise<number> {
  const meetings = await tx.classMeeting.findMany({
    where: {
      section: { courseId },
      planCustomized: false,
      status: { not: "cancelled" },
      OR: [{ status: "held" }, { closedAt: { not: null } }],
    },
    select: { id: true, seq: true, status: true, planCustomized: true, planTopic: true },
  });
  if (meetings.length === 0) return 0;
  const plans = await resolveMeetingPlans(
    meetings.map((m) => ({ id: m.id, seq: m.seq, status: m.status, courseId, planCustomized: false, planTopic: null })),
    "teacher",
    tx,
  );
  for (const m of meetings) {
    const plan = plans.get(m.id);
    const lessonIds = plan?.lessons.map((l) => l.id) ?? [];
    if (lessonIds.length) {
      await tx.classMeetingLesson.createMany({ data: lessonIds.map((lessonId, i) => ({ meetingId: m.id, lessonId, orderIndex: i })) });
    }
    await tx.classMeeting.update({ where: { id: m.id }, data: { planCustomized: true, planTopic: plan?.title ?? null } });
  }
  return meetings.length;
}

/** Thay TOÀN BỘ bảng: dòng thứ i (0-based) là buổi số i+1. */
export async function saveCourseSessionPlan(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<CourseSessionPlanView> {
  await assertCanManageCourse(actorUserId, courseId, db);
  const parsed = SaveInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseSessionPlanError("validation_failed", parsed.error.flatten());
  const sessions = parsed.data.sessions;
  if (sessions.length > COURSE_PLAN_MAX_SESSIONS) throw new CourseSessionPlanError("too_many_sessions");
  for (const s of sessions) {
    if (new Set(s.lessonIds).size !== s.lessonIds.length) throw new CourseSessionPlanError("validation_failed", "duplicate_lesson");
    if (s.lessonIds.length > MEETING_PLAN_MAX_LESSONS) throw new CourseSessionPlanError("too_many_lessons");
  }
  const distinct = [...new Set(sessions.flatMap((s) => s.lessonIds))];
  if (distinct.length) {
    const found = await db.lesson.count({ where: { id: { in: distinct }, module: { courseId } } });
    if (found !== distinct.length) throw new CourseSessionPlanError("lesson_not_in_course");
  }

  const rows = sessions.map((s, i) => ({ id: randomUUID(), courseId, sessionNo: i + 1, topic: s.topic?.trim() || null, lessonIds: s.lessonIds }));
  const frozen = await db.$transaction(async (tx) => {
    const n = await freezeClosedMeetings(courseId, tx);
    await tx.courseSession.deleteMany({ where: { courseId } });
    await tx.courseSession.createMany({ data: rows.map(({ lessonIds: _l, ...r }) => r) });
    const links = rows.flatMap((r) => r.lessonIds.map((lessonId, orderIndex) => ({ sessionId: r.id, lessonId, orderIndex })));
    if (links.length) await tx.courseSessionLesson.createMany({ data: links });
    return n;
  });

  await emitEvent(
    actorUserId,
    LearningEventType.CourseSessionPlanUpdated,
    { courseId, sessions: rows.length, lessons: rows.reduce((n, r) => n + r.lessonIds.length, 0), frozenMeetings: frozen, cleared: false },
    { courseId },
    db,
  );
  return buildView(courseId, true, db);
}

/** "Xoá phân phối": khoá quay về chương số N (hoặc trống). */
export async function clearCourseSessionPlan(actorUserId: string, courseId: string, db: PrismaClient = prisma): Promise<CourseSessionPlanView> {
  await assertCanManageCourse(actorUserId, courseId, db);
  const has = await db.courseSession.count({ where: { courseId } });
  if (has === 0) return buildView(courseId, true, db);
  const frozen = await db.$transaction(async (tx) => {
    const n = await freezeClosedMeetings(courseId, tx);
    await tx.courseSession.deleteMany({ where: { courseId } });
    return n;
  });
  await emitEvent(
    actorUserId,
    LearningEventType.CourseSessionPlanUpdated,
    { courseId, sessions: 0, lessons: 0, frozenMeetings: frozen, cleared: true },
    { courseId },
    db,
  );
  return buildView(courseId, true, db);
}

/**
 * Sao bảng phân phối sang khoá mới khi sao khoá (Duplicate, "Dùng giáo trình này"). `lessonIdMap`: id bài gốc → id bài
 * của bản sao; bài không có trong map (không được sao) bị bỏ khỏi dòng. Không kiểm quyền: người gọi đã kiểm.
 */
export async function cloneCourseSessionPlan(
  tx: DbClient,
  sourceCourseId: string,
  newCourseId: string,
  lessonIdMap: ReadonlyMap<string, string>,
): Promise<void> {
  const src = await tx.courseSession.findMany({
    where: { courseId: sourceCourseId },
    orderBy: { sessionNo: "asc" },
    select: { sessionNo: true, topic: true, lessons: { orderBy: { orderIndex: "asc" }, select: { lessonId: true } } },
  });
  if (src.length === 0) return;
  const rows = src.map((s) => ({ id: randomUUID(), courseId: newCourseId, sessionNo: s.sessionNo, topic: s.topic, lessons: s.lessons }));
  await tx.courseSession.createMany({ data: rows.map(({ lessons: _l, ...r }) => r) });
  const links = rows.flatMap((r) =>
    r.lessons.flatMap((l) => {
      const id = lessonIdMap.get(l.lessonId);
      return id ? [{ sessionId: r.id, lessonId: id }] : [];
    }).map((x, orderIndex) => ({ ...x, orderIndex })),
  );
  if (links.length) await tx.courseSessionLesson.createMany({ data: links });
}
