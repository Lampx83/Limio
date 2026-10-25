/**
 * CENTER J — Kế hoạch giảng dạy của từng buổi (docs/CENTER-schedule-attendance-AC.md, mục J).
 *
 * Giáo án theo buổi mặc định lấy từ giáo trình (chương `sessionNo` = số buổi, xem sessionPlan.ts). Ở đây giáo viên quản
 * khoá gắn BÀI trực tiếp vào một buổi: lần đầu sửa, danh sách mặc định được chép thành danh sách RIÊNG của buổi (kể cả
 * rỗng) cho tới khi "Đặt lại theo giáo trình". Danh sách gắn theo buổi, không theo số buổi, nên huỷ hay thêm buổi không
 * làm lệch.
 *
 * Quyền: chỉ người quản khoá sửa; người chỉ dạy xem buổi được xếp cho mình. Buổi đã kết thúc hoặc đã huỷ bị khoá.
 */
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { assertCanManageCourse, assertCanTeachMeeting } from "./teachingScope";
import { resolveMeetingPlans } from "./sessionPlan";

export const MEETING_PLAN_MAX_LESSONS = 30;
export const MEETING_PLAN_TOPIC_MAX = 120;

export class MeetingPlanError extends Error {
  constructor(
    public readonly code: "meeting_not_found" | "meeting_locked" | "validation_failed" | "lesson_not_in_course" | "too_many_lessons",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export interface MeetingPlanLesson {
  id: string;
  title: string;
  moduleTitle: string;
  /** Bài hoặc chương đang ẩn: giáo viên thấy, học viên không. */
  hidden: boolean;
}

export interface MeetingPlanView {
  meetingId: string;
  /** false = đang theo giáo trình (hoặc trống nếu khoá không có chương cùng số buổi). */
  customized: boolean;
  topic: string | null;
  lessons: MeetingPlanLesson[];
  /** Người gọi sửa được không (người quản khoá, và buổi chưa kết thúc, chưa huỷ). */
  editable: boolean;
}

async function loadMeeting(meetingId: string, db: DbClient) {
  const m = await db.classMeeting.findUnique({
    where: { id: meetingId },
    include: { section: { select: { id: true, courseId: true, instructorId: true } } },
  });
  if (!m) throw new MeetingPlanError("meeting_not_found");
  return m;
}
type LoadedMeeting = Awaited<ReturnType<typeof loadMeeting>>;

const isLocked = (m: { status: string; closedAt: Date | null }) => m.status !== "planned" || m.closedAt != null;

/** Kế hoạch hiệu lực (nhìn như giáo viên: có cả bài ẩn), kèm tên chương của từng bài. */
async function currentLessons(m: LoadedMeeting, db: DbClient): Promise<MeetingPlanLesson[]> {
  const plan = (
    await resolveMeetingPlans(
      [{ id: m.id, seq: m.seq, status: "planned", courseId: m.section.courseId, planCustomized: m.planCustomized, planTopic: m.planTopic }],
      "teacher",
      db,
    )
  ).get(m.id);
  const ids = plan?.lessons.map((l) => l.id) ?? [];
  if (ids.length === 0) return [];
  const rows = await db.lesson.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, isHidden: true, module: { select: { title: true, isHidden: true } } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [{ id: r.id, title: r.title, moduleTitle: r.module.title, hidden: r.isHidden || r.module.isHidden }] : [];
  });
}

async function view(m: LoadedMeeting, editable: boolean, db: DbClient): Promise<MeetingPlanView> {
  return { meetingId: m.id, customized: m.planCustomized, topic: m.planCustomized ? m.planTopic : null, lessons: await currentLessons(m, db), editable };
}

/** Xem kế hoạch: người quản khoá, hoặc người chỉ dạy được xếp vào buổi. */
export async function getMeetingPlan(actorUserId: string, meetingId: string, db: DbClient = prisma): Promise<MeetingPlanView> {
  const m = await loadMeeting(meetingId, db);
  await assertCanTeachMeeting(actorUserId, m, db);
  let manage = true;
  try {
    await assertCanManageCourse(actorUserId, m.section.courseId, db);
  } catch {
    manage = false;
  }
  return view(m, manage && !isLocked(m), db);
}

async function assertEditable(actorUserId: string, meetingId: string, db: DbClient): Promise<LoadedMeeting> {
  const m = await loadMeeting(meetingId, db);
  await assertCanManageCourse(actorUserId, m.section.courseId, db);
  if (isLocked(m)) throw new MeetingPlanError("meeting_locked");
  return m;
}

/** Mọi id phải là bài của đúng khoá của lớp. */
async function assertLessonsInCourse(lessonIds: string[], courseId: string, db: DbClient) {
  if (lessonIds.length === 0) return;
  const found = await db.lesson.count({ where: { id: { in: lessonIds }, module: { courseId } } });
  if (found !== lessonIds.length) throw new MeetingPlanError("lesson_not_in_course");
}

const TopicSchema = z.string().trim().max(MEETING_PLAN_TOPIC_MAX).nullish();

async function write(
  actorUserId: string,
  m: LoadedMeeting,
  lessonIds: string[],
  topic: string | null,
  before: MeetingPlanLesson[],
  reset: boolean,
  db: DbClient,
): Promise<MeetingPlanView> {
  const beforeIds = new Set(before.map((l) => l.id));
  const afterIds = new Set(lessonIds);
  const added = lessonIds.filter((id) => !beforeIds.has(id)).length;
  const removed = [...beforeIds].filter((id) => !afterIds.has(id)).length;

  await prisma.$transaction(async (tx) => {
    await tx.classMeetingLesson.deleteMany({ where: { meetingId: m.id } });
    if (!reset && lessonIds.length) {
      await tx.classMeetingLesson.createMany({
        data: lessonIds.map((lessonId, i) => ({ meetingId: m.id, lessonId, orderIndex: i, addedById: actorUserId })),
      });
    }
    await tx.classMeeting.update({ where: { id: m.id }, data: { planCustomized: !reset, planTopic: reset ? null : topic } });
  });

  if (added > 0 || removed > 0 || reset) {
    await emitEvent(
      actorUserId,
      LearningEventType.ClassPlanChanged,
      { meetingId: m.id, sectionId: m.sectionId, courseId: m.section.courseId, added, removed, reset },
      { courseId: m.section.courseId },
      db,
    );
  }
  const fresh = await loadMeeting(m.id, db);
  return view(fresh, true, db);
}

/**
 * Thay TOÀN BỘ kế hoạch của buổi bằng `lessonIds` (theo đúng thứ tự) và chủ đề. Dùng khi bỏ bài, đổi thứ tự, đặt chủ đề.
 * Bỏ hết bài thì buổi trống (không quay về giáo trình).
 */
export async function setMeetingPlan(
  actorUserId: string,
  meetingId: string,
  rawInput: { lessonIds: string[]; topic?: string | null },
  db: DbClient = prisma,
): Promise<MeetingPlanView> {
  const m = await assertEditable(actorUserId, meetingId, db);
  const parsed = z.object({ lessonIds: z.array(z.string().min(1)), topic: TopicSchema }).safeParse(rawInput);
  if (!parsed.success) throw new MeetingPlanError("validation_failed", parsed.error.flatten());
  const { lessonIds } = parsed.data;
  if (new Set(lessonIds).size !== lessonIds.length) throw new MeetingPlanError("validation_failed", "duplicate_lesson");
  if (lessonIds.length > MEETING_PLAN_MAX_LESSONS) throw new MeetingPlanError("too_many_lessons");
  await assertLessonsInCourse(lessonIds, m.section.courseId, db);
  const before = await currentLessons(m, db);
  const topic = parsed.data.topic?.trim() || null;
  // Không đổi gì so với kế hoạch hiệu lực hiện tại (kể cả chưa tuỳ chỉnh): không tạo bản tuỳ chỉnh, không phát sự kiện.
  const same = before.length === lessonIds.length && before.every((l, i) => l.id === lessonIds[i]);
  if (same && !m.planCustomized && topic === null) return view(m, true, db);
  return write(actorUserId, m, lessonIds, topic, before, false, db);
}

/**
 * Thêm bài vào cuối kế hoạch. Lần đầu (buổi còn theo giáo trình) danh sách mặc định được chép trước rồi mới thêm.
 * Bài đã có thì bỏ qua.
 */
export async function addMeetingPlanLessons(
  actorUserId: string,
  meetingId: string,
  lessonIds: string[],
  db: DbClient = prisma,
): Promise<MeetingPlanView> {
  const m = await assertEditable(actorUserId, meetingId, db);
  if (!Array.isArray(lessonIds) || lessonIds.some((x) => typeof x !== "string" || !x)) throw new MeetingPlanError("validation_failed");
  await assertLessonsInCourse([...new Set(lessonIds)], m.section.courseId, db);
  const before = await currentLessons(m, db);
  const have = new Set(before.map((l) => l.id));
  const toAdd = [...new Set(lessonIds)].filter((id) => !have.has(id));
  const next = [...before.map((l) => l.id), ...toAdd];
  if (next.length > MEETING_PLAN_MAX_LESSONS) throw new MeetingPlanError("too_many_lessons");
  if (toAdd.length === 0) return view(m, true, db);
  return write(actorUserId, m, next, m.planTopic, before, false, db);
}

/** "Đặt lại theo giáo trình": xoá danh sách riêng và chủ đề, quay về chương cùng số buổi. */
export async function resetMeetingPlan(actorUserId: string, meetingId: string, db: DbClient = prisma): Promise<MeetingPlanView> {
  const m = await assertEditable(actorUserId, meetingId, db);
  const before = await currentLessons(m, db);
  if (!m.planCustomized) return view(m, true, db);
  // Sau khi đặt lại, danh sách hiệu lực là chương giáo trình; tính added/removed so với danh sách mặc định đó.
  const afterMeeting = { ...m, planCustomized: false, planTopic: null };
  const after = await currentLessons(afterMeeting, db);
  const result = await write(actorUserId, m, after.map((l) => l.id), null, before, true, db);
  return result;
}
