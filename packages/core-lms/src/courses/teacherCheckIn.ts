/**
 * CENTER C5 — giáo viên bắt đầu buổi và đối chiếu lịch dạy (docs/CENTER-schedule-attendance-AC.md, mục C5).
 *
 * Cách trình bày là "đối chiếu lịch để xếp dạy bù", KHÔNG phải chấm công. Một dòng `TeacherCheckIn` cho mỗi buổi: người
 * bấm đầu tiên thắng, bấm lại không ghi đè. Độ lệch (đúng giờ, trễ, kết thúc sớm, dạy thay, không check-in) tính khi đọc
 * từ giờ của buổi, giáo viên dự kiến và ngưỡng của tổ chức (xem teacherCheckInCalc.ts).
 *
 *  - Ai bấm được: người có tên trong khoá (chủ khoá, đồng giảng viên, người chỉ dạy). Người khác giáo viên dự kiến bấm
 *    thì là "dạy thay".
 *  - Ai xem: giáo viên chỉ xem của mình; quản trị trường (và Platform Admin) xem cả trường và sửa khi giáo viên quên bấm,
 *    kèm lý do bắt buộc.
 *  - "Kết thúc buổi" (C4.1) ghi giờ ra nếu đã có giờ vào.
 */
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { emitEvent } from "../learning/events";
import { CourseAuthzError } from "./authz";
import { rangeBounds } from "./classSchedule";
import { assertCanTeachMeeting, getTeachingScope } from "./teachingScope";
import {
  DEFAULT_CHECKIN_THRESHOLD_MIN,
  checkInWindow,
  classifyCheckIn,
  type CheckInFlag,
  type CheckInState,
} from "./teacherCheckInCalc";

export class TeacherCheckInError extends Error {
  constructor(
    public readonly code: "meeting_not_found" | "meeting_cancelled" | "check_in_not_open" | "check_in_closed" | "validation_failed",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export interface PersonRef {
  id: string;
  name: string;
}

export interface MeetingCheckInView {
  meetingId: string;
  window: { state: "not_open" | "open" | "closed"; opensAt: string; closesAt: string };
  thresholdMin: number;
  expectedTeacher: PersonRef | null;
  checkIn: { teacherId: string; teacherName: string; checkedInAt: string; checkedOutAt: string | null; method: string } | null;
  state: CheckInState;
  flags: CheckInFlag[];
  minutesAfterStart: number | null;
  minutesBeforeEnd: number | null;
  /** Bấm "Bắt đầu buổi" được ngay lúc này (trong cửa sổ, chưa ai bấm, buổi chưa huỷ). */
  canCheckIn: boolean;
}

const MEETING_INCLUDE = {
  plannedTeacher: { select: { id: true, displayName: true } },
  checkIn: { include: { teacher: { select: { id: true, displayName: true } } } },
  section: {
    select: {
      id: true,
      name: true,
      courseId: true,
      instructorId: true,
      instructor: { select: { id: true, displayName: true } },
      course: { select: { title: true, organizationId: true } },
    },
  },
} as const;

async function loadMeeting(meetingId: string, db: DbClient) {
  const m = await db.classMeeting.findUnique({ where: { id: meetingId }, include: MEETING_INCLUDE });
  if (!m) throw new TeacherCheckInError("meeting_not_found");
  return m;
}
type LoadedMeeting = Awaited<ReturnType<typeof loadMeeting>>;

/** Giáo viên dự kiến của buổi; buổi chưa gán thì là giáo viên phụ trách lớp; không có ai thì null. */
function expectedTeacher(m: LoadedMeeting): PersonRef | null {
  if (m.plannedTeacher) return { id: m.plannedTeacher.id, name: m.plannedTeacher.displayName };
  if (m.section.instructor) return { id: m.section.instructor.id, name: m.section.instructor.displayName };
  return null;
}

async function thresholdsFor(orgIds: Array<string | null>, db: DbClient): Promise<Map<string | null, number>> {
  const ids = [...new Set(orgIds.filter((x): x is string => !!x))];
  const rows = ids.length ? await db.organization.findMany({ where: { id: { in: ids } }, select: { id: true, checkinThresholdMin: true } }) : [];
  const map = new Map<string | null, number>(rows.map((r) => [r.id, r.checkinThresholdMin]));
  map.set(null, DEFAULT_CHECKIN_THRESHOLD_MIN);
  return map;
}

function classify(m: LoadedMeeting, thresholdMin: number, now: Date) {
  return classifyCheckIn({
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    cancelled: m.status === "cancelled",
    expectedTeacherId: expectedTeacher(m)?.id ?? null,
    checkIn: m.checkIn ? { teacherId: m.checkIn.teacherId, checkedInAt: m.checkIn.checkedInAt, checkedOutAt: m.checkIn.checkedOutAt } : null,
    thresholdMin,
    now,
  });
}

async function buildView(m: LoadedMeeting, now: Date, db: DbClient): Promise<MeetingCheckInView> {
  const th = (await thresholdsFor([m.section.course.organizationId], db)).get(m.section.course.organizationId) ?? DEFAULT_CHECKIN_THRESHOLD_MIN;
  const win = checkInWindow(m.startsAt, m.endsAt);
  const cls = classify(m, th, now);
  const windowState = now.getTime() < win.opensAt.getTime() ? "not_open" : now.getTime() > win.closesAt.getTime() ? "closed" : "open";
  return {
    meetingId: m.id,
    window: { state: windowState, opensAt: win.opensAt.toISOString(), closesAt: win.closesAt.toISOString() },
    thresholdMin: th,
    expectedTeacher: expectedTeacher(m),
    checkIn: m.checkIn
      ? {
          teacherId: m.checkIn.teacherId,
          teacherName: m.checkIn.teacher.displayName,
          checkedInAt: m.checkIn.checkedInAt.toISOString(),
          checkedOutAt: m.checkIn.checkedOutAt?.toISOString() ?? null,
          method: m.checkIn.method,
        }
      : null,
    ...cls,
    canCheckIn: windowState === "open" && !m.checkIn && m.status !== "cancelled",
  };
}

/** Xem trạng thái bắt đầu buổi: người quản khoá, hoặc người được xếp vào buổi. */
export async function getMeetingCheckIn(
  actorUserId: string,
  meetingId: string,
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<MeetingCheckInView> {
  const m = await loadMeeting(meetingId, db);
  await assertCanTeachMeeting(actorUserId, { plannedTeacherId: m.plannedTeacherId, section: { courseId: m.section.courseId, instructorId: m.section.instructorId } }, db);
  return buildView(m, now, db);
}

/**
 * Bấm "Bắt đầu buổi" (C5.1, C5.2). Người có tên trong khoá mới bấm được; người khác giáo viên dự kiến bấm thì là dạy thay.
 * Chỉ trong cửa sổ từ 30 phút trước giờ bắt đầu tới giờ kết thúc. Bấm lại không ghi đè và không phát thêm sự kiện.
 */
export async function checkInToMeeting(
  actorUserId: string,
  meetingId: string,
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<MeetingCheckInView> {
  const m = await loadMeeting(meetingId, db);
  if ((await getTeachingScope(actorUserId, m.section.courseId, db)) === null) throw new CourseAuthzError("forbidden");
  if (m.status === "cancelled") throw new TeacherCheckInError("meeting_cancelled");
  if (m.checkIn) return buildView(m, now, db);

  const win = checkInWindow(m.startsAt, m.endsAt);
  if (now.getTime() < win.opensAt.getTime()) throw new TeacherCheckInError("check_in_not_open");
  if (now.getTime() > win.closesAt.getTime()) throw new TeacherCheckInError("check_in_closed");

  const expected = expectedTeacher(m);
  try {
    await db.teacherCheckIn.create({ data: { meetingId, teacherId: actorUserId, checkedInAt: now, method: "self" } });
  } catch (e) {
    // Hai người bấm cùng lúc: người sau không ghi đè, đọc lại dòng của người trước.
    if ((e as { code?: string }).code !== "P2002") throw e;
    return buildView(await loadMeeting(meetingId, db), now, db);
  }
  await emitEvent(
    actorUserId,
    LearningEventType.TeacherCheckedIn,
    {
      meetingId,
      sectionId: m.sectionId,
      courseId: m.section.courseId,
      substitute: expected !== null && expected.id !== actorUserId,
      plannedTeacherId: expected?.id ?? null,
    },
    { courseId: m.section.courseId, eventKey: `attendance.teacher.checked_in:${meetingId}` },
    db,
  );
  return buildView(await loadMeeting(meetingId, db), now, db);
}

// ── Danh sách và báo cáo ─────────────────────────────────────────────────

export interface CheckInRow {
  meetingId: string;
  courseId: string;
  courseTitle: string;
  sectionId: string;
  sectionName: string;
  seq: number | null;
  startsAt: string;
  endsAt: string;
  expectedTeacher: PersonRef | null;
  actualTeacher: PersonRef | null;
  state: CheckInState;
  flags: CheckInFlag[];
  minutesAfterStart: number | null;
  minutesBeforeEnd: number | null;
  /** Buổi đã kết thúc (C4.1) mà chưa điểm danh học viên nào (C5.5). */
  attendanceMissing: boolean;
  /** Đã được quản trị sửa tay (C5.10). */
  editedByAdmin: boolean;
}

async function toRows(meetings: LoadedMeeting[], now: Date, db: DbClient): Promise<CheckInRow[]> {
  if (meetings.length === 0) return [];
  const [th, att] = await Promise.all([
    thresholdsFor(meetings.map((m) => m.section.course.organizationId), db),
    db.studentAttendance.groupBy({ by: ["meetingId"], where: { meetingId: { in: meetings.map((m) => m.id) } }, _count: { _all: true } }),
  ]);
  const marked = new Set(att.map((a) => a.meetingId));
  return meetings.map((m) => {
    const cls = classify(m, th.get(m.section.course.organizationId) ?? DEFAULT_CHECKIN_THRESHOLD_MIN, now);
    return {
      meetingId: m.id,
      courseId: m.section.courseId,
      courseTitle: m.section.course.title,
      sectionId: m.sectionId,
      sectionName: m.section.name,
      seq: m.seq,
      startsAt: m.startsAt.toISOString(),
      endsAt: m.endsAt.toISOString(),
      expectedTeacher: expectedTeacher(m),
      actualTeacher: m.checkIn ? { id: m.checkIn.teacher.id, name: m.checkIn.teacher.displayName } : null,
      ...cls,
      attendanceMissing: m.closedAt != null && !marked.has(m.id),
      editedByAdmin: m.checkIn?.method === "admin",
    };
  });
}

/** Các buổi của CHÍNH MÌNH trong khoảng ngày (giờ VN): được xếp dạy hoặc đã dạy thay (C5.7). */
export async function listMyCheckIns(
  actorUserId: string,
  rawRange: { from: string; to: string },
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<CheckInRow[]> {
  const { start, end } = (() => {
    try {
      return rangeBounds(rawRange.from, rawRange.to);
    } catch {
      throw new TeacherCheckInError("validation_failed");
    }
  })();
  const meetings = await db.classMeeting.findMany({
    where: {
      startsAt: { gte: start, lt: end },
      status: { not: "cancelled" },
      OR: [{ plannedTeacherId: actorUserId }, { plannedTeacherId: null, section: { instructorId: actorUserId } }, { checkIn: { teacherId: actorUserId } }],
    },
    orderBy: { startsAt: "asc" },
    include: MEETING_INCLUDE,
  });
  return toRows(meetings, now, db);
}

export interface TeacherTally {
  /** null = buổi chưa xếp giáo viên. */
  teacherId: string | null;
  name: string;
  /** Số buổi đã diễn ra (có người bấm hoặc đã qua giờ) thuộc về người này. */
  meetings: number;
  onTime: number;
  late: number;
  earlyEnd: number;
  /** Số buổi người này dạy thay cho người khác. */
  substitute: number;
  /** Số buổi được xếp cho người này mà không ai bấm. */
  noCheckIn: number;
  attendanceMissing: number;
}

export interface OrgReconciliation {
  organizationId: string;
  from: string;
  to: string;
  thresholdMin: number;
  teachers: TeacherTally[];
  meetings: CheckInRow[];
}

async function assertOrgAdmin(actorUserId: string, organizationId: string | null, db: DbClient) {
  const ok = organizationId ? await isOrgAdminOf(actorUserId, organizationId, db) : await isAdmin(actorUserId, db);
  if (!ok) throw new CourseAuthzError("forbidden");
}

/**
 * Báo cáo tuần cho chủ trung tâm (C5.6, C5.7): mỗi giáo viên bao nhiêu buổi đúng giờ, trễ, kết thúc sớm, dạy thay, không
 * check-in và chưa điểm danh; kèm danh sách từng buổi để xem chi tiết. Chỉ quản trị trường (và Platform Admin).
 */
export async function getOrgReconciliation(
  actorUserId: string,
  organizationId: string,
  rawRange: { from: string; to: string },
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<OrgReconciliation> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  let bounds: { start: Date; end: Date };
  try {
    bounds = rangeBounds(rawRange.from, rawRange.to);
  } catch {
    throw new TeacherCheckInError("validation_failed");
  }
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { checkinThresholdMin: true } });
  const meetings = await db.classMeeting.findMany({
    where: { startsAt: { gte: bounds.start, lt: bounds.end }, status: { not: "cancelled" }, section: { course: { organizationId } } },
    orderBy: { startsAt: "asc" },
    include: MEETING_INCLUDE,
  });
  const rows = await toRows(meetings, now, db);

  const tallies = new Map<string | null, TeacherTally>();
  const tally = (p: PersonRef | null) => {
    const key = p?.id ?? null;
    let t = tallies.get(key);
    if (!t) tallies.set(key, (t = { teacherId: key, name: p?.name ?? "Chưa xếp giáo viên", meetings: 0, onTime: 0, late: 0, earlyEnd: 0, substitute: 0, noCheckIn: 0, attendanceMissing: 0 }));
    return t;
  };
  for (const r of rows) {
    // Buổi chưa tới hoặc đang diễn ra mà chưa ai bấm thì chưa có gì để đối chiếu.
    if (r.state === "waiting") continue;
    const owner = r.actualTeacher ?? r.expectedTeacher;
    const t = tally(owner);
    t.meetings++;
    if (r.state === "no_check_in") t.noCheckIn++;
    if (r.flags.includes("on_time")) t.onTime++;
    if (r.flags.includes("late")) t.late++;
    if (r.flags.includes("early_end")) t.earlyEnd++;
    if (r.flags.includes("substitute")) t.substitute++;
    if (r.attendanceMissing) t.attendanceMissing++;
  }
  return {
    organizationId,
    from: rawRange.from,
    to: rawRange.to,
    thresholdMin: org?.checkinThresholdMin ?? DEFAULT_CHECKIN_THRESHOLD_MIN,
    teachers: [...tallies.values()].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    meetings: rows,
  };
}

// ── Quản trị sửa (C5.10) ─────────────────────────────────────────────────

const EditInput = z.object({
  teacherId: z.string().min(1),
  checkedInAt: z.string().datetime(),
  checkedOutAt: z.string().datetime().nullish(),
  reason: z.string().trim().min(1).max(300),
});

/**
 * Giáo viên quên bấm: quản trị trường sửa hoặc tạo dòng check-in, BẮT BUỘC có lý do. Dòng được đánh dấu `admin`, ghi
 * người sửa và lý do; sự kiện attendance.teacher.edited chỉ mang tên trường đã đổi và độ dài lý do.
 */
export async function editTeacherCheckIn(
  actorUserId: string,
  meetingId: string,
  rawInput: unknown,
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<MeetingCheckInView> {
  const m = await loadMeeting(meetingId, db);
  await assertOrgAdmin(actorUserId, m.section.course.organizationId, db);
  const parsed = EditInput.safeParse(rawInput);
  if (!parsed.success) throw new TeacherCheckInError("validation_failed", parsed.error.flatten());
  const input = parsed.data;
  const inAt = new Date(input.checkedInAt);
  const outAt = input.checkedOutAt ? new Date(input.checkedOutAt) : null;
  if (outAt && outAt.getTime() < inAt.getTime()) throw new TeacherCheckInError("validation_failed", "out_before_in");

  // Người dạy phải là người có tên trong khoá (hoặc giáo viên dự kiến / phụ trách lớp).
  const member =
    (await db.courseInstructor.findUnique({ where: { courseId_userId: { courseId: m.section.courseId, userId: input.teacherId } }, select: { userId: true } })) !== null ||
    input.teacherId === m.plannedTeacherId ||
    input.teacherId === m.section.instructorId;
  if (!member) throw new TeacherCheckInError("validation_failed", "teacher_not_in_course");

  const old = m.checkIn;
  const changed: string[] = [];
  if (!old || old.teacherId !== input.teacherId) changed.push("teacherId");
  if (!old || old.checkedInAt.getTime() !== inAt.getTime()) changed.push("checkedInAt");
  if ((old?.checkedOutAt?.getTime() ?? null) !== (outAt?.getTime() ?? null) && (old || outAt)) changed.push("checkedOutAt");

  await db.teacherCheckIn.upsert({
    where: { meetingId },
    create: { meetingId, teacherId: input.teacherId, checkedInAt: inAt, checkedOutAt: outAt, method: "admin", editedById: actorUserId, editReason: input.reason },
    update: { teacherId: input.teacherId, checkedInAt: inAt, checkedOutAt: outAt, method: "admin", editedById: actorUserId, editReason: input.reason },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.TeacherCheckInEdited,
    { meetingId, sectionId: m.sectionId, courseId: m.section.courseId, editedById: actorUserId, changed, reasonLength: input.reason.length },
    { courseId: m.section.courseId },
    db,
  );
  return buildView(await loadMeeting(meetingId, db), now, db);
}
