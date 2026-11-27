/**
 * CENTER M — dữ liệu cho Bảng điều phối lịch (docs/CENTER-dashboard-dieu-phoi-AC.md, mục M). Chỉ ĐỌC. Mọi định nghĩa (trạng thái buổi, cờ,
 * trùng phòng, vòng đời lớp) nằm ở centerBoardCalc.ts để dashboard và bảng dùng chung.
 *
 * Ai xem (Q1): quản trị trường (OrgAdmin) và Platform Admin thấy cả tổ chức; chủ khoá và đồng giảng viên (người `manage`) thấy các khoá
 * của mình thuộc tổ chức đó. Người chỉ dạy (giảng viên trung tâm) chỉ thấy các buổi và lớp ĐƯỢC XẾP cho mình, chỉ xem, không mở trang buổi.
 * Người ngoài bị từ chối. Tải MỘT lần cho cả khoảng, tính vị trí/làn ở trình duyệt.
 */
import { prisma } from "@feedbackme/db";
import type { Prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { CourseAuthzError, EDIT_ROLES } from "./authz";
import { rangeBounds } from "./classSchedule";
import {
  classLifecycle,
  deriveCourseLevel,
  detectClashes,
  meetingDisplayState,
  meetingFlags,
  roomKey,
  type BoardFlag,
  type ClassLifecycle,
  type MeetingDisplayState,
} from "./centerBoardCalc";
import { DEFAULT_CHECKIN_THRESHOLD_MIN, classifyCheckIn } from "./teacherCheckInCalc";

export interface BoardPerson {
  id: string;
  name: string;
}

export interface BoardMeeting {
  id: string;
  sectionId: string;
  sectionName: string;
  courseId: string;
  courseTitle: string;
  /** Trình độ của khoá (vd "HSK 3"), rút ở `deriveCourseLevel`; null = chưa rõ. Giao diện gom hàng theo trình độ. */
  level: string | null;
  seq: number | null;
  startsAt: string;
  endsAt: string;
  room: string | null;
  /** Khoá gom phòng (đã chuẩn hoá hoa thường/khoảng trắng); null = chưa xếp phòng. Giao diện gom hàng theo khoá này. */
  roomKey: string | null;
  state: MeetingDisplayState;
  /** Giáo viên dự kiến; buổi chưa gán thì là giáo viên phụ trách lớp; không có thì null. */
  teacher: BoardPerson | null;
  /** Người thực sự bắt đầu buổi (khác `teacher` = dạy thay). */
  actualTeacher: BoardPerson | null;
  flags: BoardFlag[];
  /**
   * Người xem MỞ được buổi này (trang điểm danh, huỷ, dạy bù, đổi giờ): Platform Admin, chủ khoá hoặc đồng giảng viên của khoá. Quản trị trường không có tên
   * trong khoá chỉ XEM bảng, không mở được trang buổi (các trang đó kiểm quyền theo khoá), nên giao diện không được dẫn họ tới đó.
   */
  canManage: boolean;
}

export interface OrgBoard {
  organizationId: string;
  from: string;
  to: string;
  thresholdMin: number;
  /** Người xem thấy toàn bộ tổ chức (OrgAdmin/Platform Admin) hay chỉ các khoá mình quản. */
  scope: "org" | "mine";
  meetings: BoardMeeting[];
}

export interface BoardClass {
  sectionId: string;
  name: string;
  courseId: string;
  courseTitle: string;
  level: string | null;
  teacher: BoardPerson | null;
  enrolled: number;
  lifecycle: Omit<ClassLifecycle, "start" | "end"> & { start: string | null; end: string | null };
  /** Buổi tiếp theo chưa dạy (ISO), null nếu không còn. */
  nextMeetingAt: string | null;
  /** Như `BoardMeeting.canManage`, cho trang lớp và nút "Đặt lịch". */
  canManage: boolean;
}

export interface OrgClassTimeline {
  organizationId: string;
  from: string;
  to: string;
  scope: "org" | "mine";
  classes: BoardClass[];
}

interface Scope {
  scope: "org" | "mine";
  where: Prisma.CourseWhereInput;
  actorUserId: string;
  isOrgWide: boolean;
  /** Người chỉ dạy: chỉ buổi/lớp được xếp cho mình, dù khoá có nhiều buổi khác. */
  assignedOnly: boolean;
}

/** Xác định người xem được thấy gì ở tổ chức này (Q1); ném `forbidden` nếu không có quyền nào. */
async function resolveScope(actorUserId: string, organizationId: string, db: DbClient): Promise<Scope> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new CourseAuthzError("not_found");
  if ((await isAdmin(actorUserId, db)) || (await isOrgAdminOf(actorUserId, organizationId, db))) {
    return { scope: "org", where: { organizationId }, actorUserId, isOrgWide: true, assignedOnly: false };
  }
  const mine = await db.courseInstructor.count({ where: { userId: actorUserId, role: { in: [...EDIT_ROLES] }, course: { organizationId } } });
  if (mine === 0) {
    // Người chỉ dạy: có tên trong khoá của tổ chức nhưng không có quyền sửa; chỉ xem phần được xếp cho mình.
    const taught = await db.courseInstructor.count({ where: { userId: actorUserId, course: { organizationId } } });
    if (taught === 0) throw new CourseAuthzError("forbidden");
    return { scope: "mine", where: { organizationId, instructors: { some: { userId: actorUserId } } }, actorUserId, isOrgWide: false, assignedOnly: true };
  }
  return {
    scope: "mine",
    where: { organizationId, instructors: { some: { userId: actorUserId, role: { in: [...EDIT_ROLES] } } } },
    actorUserId,
    isOrgWide: false,
    assignedOnly: false,
  };
}

/** Các khoá người xem mở được trang buổi/lớp: null = mọi khoá (Platform Admin, quản trị của trường), còn lại là tập khoá mình là chủ hoặc đồng giảng viên. */
async function manageableCourses(actorUserId: string, organizationId: string, db: DbClient): Promise<Set<string> | null> {
  if (await isOrgAdminOf(actorUserId, organizationId, db)) return null;
  const rows = await db.courseInstructor.findMany({ where: { userId: actorUserId, role: { in: [...EDIT_ROLES] }, course: { organizationId } }, select: { courseId: true } });
  return new Set(rows.map((r) => r.courseId));
}

function person(u: { id: string; displayName: string } | null | undefined): BoardPerson | null {
  return u ? { id: u.id, name: u.displayName } : null;
}

const MEETING_INCLUDE = {
  plannedTeacher: { select: { id: true, displayName: true } },
  checkIn: { select: { teacherId: true, checkedInAt: true, checkedOutAt: true, teacher: { select: { id: true, displayName: true } } } },
  section: {
    select: {
      id: true,
      name: true,
      courseId: true,
      instructor: { select: { id: true, displayName: true } },
      course: { select: { title: true, levelBand: true, fromPack: { select: { outcomeLevel: true } } } },
    },
  },
} as const;

/** Mọi buổi của tổ chức giao với khoảng ngày [from, to] (giờ VN), kèm trạng thái, cờ cần chú ý và trùng phòng/giáo viên. */
export async function getOrgBoard(
  actorUserId: string,
  organizationId: string,
  rawRange: { from: string; to: string },
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<OrgBoard> {
  const sc = await resolveScope(actorUserId, organizationId, db);
  const { start, end } = rangeBounds(rawRange.from, rawRange.to);
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { checkinThresholdMin: true } });
  const thresholdMin = org?.checkinThresholdMin ?? DEFAULT_CHECKIN_THRESHOLD_MIN;

  const rows = await db.classMeeting.findMany({
    where: {
      startsAt: { lt: end },
      endsAt: { gt: start },
      section: { course: sc.where },
      // Cùng luật `isAssignedToMeeting`: giáo viên dự kiến của buổi, hoặc buổi chưa gán và mình phụ trách lớp.
      ...(sc.assignedOnly
        ? { OR: [{ plannedTeacherId: actorUserId }, { plannedTeacherId: null, section: { instructorId: actorUserId } }] }
        : {}),
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    include: MEETING_INCLUDE,
  });
  const ids = rows.map((r) => r.id);
  const marked = new Set(
    ids.length ? (await db.studentAttendance.groupBy({ by: ["meetingId"], where: { meetingId: { in: ids } }, _count: { _all: true } })).map((a) => a.meetingId) : [],
  );
  const manageable = await manageableCourses(actorUserId, organizationId, db);

  const teacherOf = (m: (typeof rows)[number]) => person(m.plannedTeacher) ?? person(m.section.instructor);
  const clashes = detectClashes(
    rows.map((m) => ({ id: m.id, startsAt: m.startsAt, endsAt: m.endsAt, room: m.room, teacherId: teacherOf(m)?.id ?? null, cancelled: m.status === "cancelled" })),
  );

  const meetings: BoardMeeting[] = rows.map((m) => {
    const state = meetingDisplayState({ status: m.status, startsAt: m.startsAt, endsAt: m.endsAt, now });
    const teacher = teacherOf(m);
    const cls = classifyCheckIn({
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      cancelled: m.status === "cancelled",
      expectedTeacherId: teacher?.id ?? null,
      checkIn: m.checkIn ? { teacherId: m.checkIn.teacherId, checkedInAt: m.checkIn.checkedInAt, checkedOutAt: m.checkIn.checkedOutAt } : null,
      thresholdMin,
      now,
    });
    return {
      id: m.id,
      sectionId: m.sectionId,
      sectionName: m.section.name,
      courseId: m.section.courseId,
      courseTitle: m.section.course.title,
      level: deriveCourseLevel({ packLevel: m.section.course.fromPack?.outcomeLevel, title: m.section.course.title, levelBand: m.section.course.levelBand }),
      seq: m.seq,
      startsAt: m.startsAt.toISOString(),
      endsAt: m.endsAt.toISOString(),
      room: m.room,
      roomKey: roomKey(m.room),
      state,
      teacher,
      actualTeacher: m.checkIn ? person(m.checkIn.teacher) : null,
      flags: meetingFlags({
        state,
        hasExpectedTeacher: teacher !== null,
        checkedIn: m.checkIn !== null,
        checkInFlags: cls.flags,
        attendanceMissing: m.closedAt != null && !marked.has(m.id),
        startsAt: m.startsAt,
        thresholdMin,
        now,
        clash: clashes.get(m.id) ?? { room: false, teacher: false },
      }),
      canManage: manageable === null || manageable.has(m.section.courseId),
    };
  });
  return { organizationId, from: rawRange.from, to: rawRange.to, thresholdMin, scope: sc.scope, meetings };
}

/**
 * Vòng đời các lớp của tổ chức (M3): mỗi lớp một khối từ buổi đầu tới buổi cuối, kèm tiến độ. Chỉ lấy lớp có buổi giao với khoảng xem,
 * cộng lớp CHƯA đặt lịch (để hiện ở nhóm "Chưa đặt lịch"). Lớp mặc định (isDefault) của khoá bị bỏ qua.
 */
export async function getOrgClassTimeline(
  actorUserId: string,
  organizationId: string,
  rawRange: { from: string; to: string },
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<OrgClassTimeline> {
  const sc = await resolveScope(actorUserId, organizationId, db);
  const { start, end } = rangeBounds(rawRange.from, rawRange.to);
  const sections = await db.courseSection.findMany({
    where: {
      isDefault: false,
      course: sc.where,
      ...(sc.assignedOnly ? { OR: [{ instructorId: actorUserId }, { classMeetings: { some: { plannedTeacherId: actorUserId } } }] } : {}),
    },
    select: {
      id: true,
      name: true,
      courseId: true,
      course: { select: { title: true, levelBand: true, fromPack: { select: { outcomeLevel: true } } } },
      instructor: { select: { id: true, displayName: true } },
      classMeetings: { select: { startsAt: true, endsAt: true, status: true }, orderBy: { startsAt: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  const counts = sections.length
    ? await db.enrollment.groupBy({ by: ["sectionId"], where: { sectionId: { in: sections.map((s) => s.id) }, status: { in: ["active", "completed"] } }, _count: { _all: true } })
    : [];
  const enrolled = new Map(counts.map((c) => [c.sectionId, c._count._all]));
  const manageable = await manageableCourses(actorUserId, organizationId, db);

  const classes: BoardClass[] = [];
  for (const s of sections) {
    const lc = classLifecycle(s.classMeetings, now);
    // Lớp có lịch nhưng vòng đời không giao với khoảng đang xem thì bỏ.
    if (lc.status !== "no_schedule" && !(lc.start!.getTime() < end.getTime() && lc.end!.getTime() > start.getTime())) continue;
    const next = s.classMeetings.find((m) => m.status === "planned" && m.startsAt.getTime() >= now.getTime());
    classes.push({
      sectionId: s.id,
      name: s.name,
      courseId: s.courseId,
      courseTitle: s.course.title,
      level: deriveCourseLevel({ packLevel: s.course.fromPack?.outcomeLevel, title: s.course.title, levelBand: s.course.levelBand }),
      teacher: person(s.instructor),
      enrolled: enrolled.get(s.id) ?? 0,
      lifecycle: { ...lc, start: lc.start?.toISOString() ?? null, end: lc.end?.toISOString() ?? null },
      nextMeetingAt: next?.startsAt.toISOString() ?? null,
      canManage: manageable === null || manageable.has(s.courseId),
    });
  }
  classes.sort((a, b) => (a.lifecycle.start ?? "9").localeCompare(b.lifecycle.start ?? "9") || a.name.localeCompare(b.name, "vi"));
  return { organizationId, from: rawRange.from, to: rawRange.to, scope: sc.scope, classes };
}
