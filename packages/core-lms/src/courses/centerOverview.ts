/**
 * Tổng quan trung tâm cho quản trị trường (CENTER L, docs/CENTER-dashboard-dieu-phoi-AC.md): hôm nay có ổn không, giáo viên, lớp,
 * học viên cần liên hệ. Chỉ ĐỌC. Dùng lại bảng điều phối (`getOrgBoard`, `getOrgClassTimeline`) và đối chiếu lịch dạy
 * (`getOrgReconciliation`) nên số liệu khớp các trang đó; không tính lại định nghĩa nào.
 * Ngưỡng là hằng (`OVERVIEW_DEFAULTS`); cấu hình theo tổ chức (L6) để sau.
 */
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { isOrgAdminOf } from "../auth/roles";
import { emitEvent } from "../learning/events";
import { CourseAuthzError } from "./authz";
import { getOrgBoard, getOrgClassTimeline, type BoardClass } from "./centerBoard";
import { getOrgReconciliation, type TeacherTally } from "./teacherCheckIn";
import { addDays, vnDateTime, vnDayKey } from "./classScheduleCalc";
import { classAttendance, findAtRisk, hoursByTeacher, isEndingSoon, OVERVIEW_DEFAULTS, type AttendanceStatusValue, type OverviewThresholds } from "./centerOverviewCalc";

export interface OverviewAlerts {
  /** Buổi từ bây giờ tới 7 ngày tới chưa có giáo viên. */
  noTeacher: number;
  /** Buổi hôm nay quá giờ mà giáo viên dự kiến chưa bắt đầu. */
  noCheckIn: number;
  /** Buổi đã dạy trong 7 ngày qua chưa điểm danh. */
  noAttendance: number;
  /** Buổi trùng phòng hoặc trùng giáo viên từ hôm nay tới 6 ngày tới. */
  clashes: number;
}

export interface OverviewTeacher {
  teacherId: string;
  name: string;
  /** Đối chiếu trong cửa sổ (cùng số với trang Đối chiếu lịch dạy). */
  meetings: number;
  onTime: number;
  late: number;
  substitute: number;
  noCheckIn: number;
  hoursTaught: number;
  /** Giờ đã xếp từ hôm nay tới 6 ngày tới. */
  hoursPlanned: number;
  overloaded: boolean;
  /** Chưa dạy buổi nào trong cửa sổ và chưa được xếp buổi nào sắp tới. */
  unassigned: boolean;
}

export interface OverviewClass {
  sectionId: string;
  name: string;
  courseId: string;
  courseTitle: string;
  level: string | null;
  teacher: { id: string; name: string } | null;
  enrolled: number;
  held: number;
  total: number;
  status: BoardClass["lifecycle"]["status"];
  end: string | null;
  /** Chuyên cần trong cửa sổ (0..1), null khi chưa đủ mẫu. */
  attendanceRate: number | null;
  attendanceLow: boolean;
  /** Buổi đã dạy trong cửa sổ mà chưa điểm danh. */
  unmarked: number;
  endingSoon: boolean;
  canManage: boolean;
}

export interface OverviewStudent {
  userId: string;
  name: string;
  sectionId: string;
  sectionName: string;
  courseId: string;
  consecutive: number;
  attendanceRate: number | null;
  lastAbsentAt: string | null;
  reasons: Array<"consecutive" | "low_rate">;
}

export interface OrgOverview {
  organizationId: string;
  today: string;
  thresholds: OverviewThresholds;
  todayCounts: { total: number; live: number; upcoming: number; held: number; overdue: number; cancelled: number };
  alerts: OverviewAlerts;
  teachers: OverviewTeacher[];
  classes: OverviewClass[];
  /** Tổng số học viên cần liên hệ (danh sách `atRisk` cắt ở `AT_RISK_LIMIT`). */
  atRiskTotal: number;
  atRisk: OverviewStudent[];
}

export const AT_RISK_LIMIT = 100;
const ATTENDANCE_ROW_CAP = 200_000;

/** `today` là ngày giờ Việt Nam (YYYY-MM-DD), do trang tính để "hôm nay" cắt đúng múi giờ. */
export async function getOrgOverview(
  actorUserId: string,
  organizationId: string,
  today: string,
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<OrgOverview> {
  // Chỉ quản trị trường (và Platform Admin): danh sách có tên học viên (L4).
  if (!(await isOrgAdminOf(actorUserId, organizationId, db))) throw new CourseAuthzError("forbidden");
  const th: OverviewThresholds = { ...OVERVIEW_DEFAULTS };
  const winFrom = addDays(today, -(th.windowDays - 1));
  const winStart = vnDateTime(winFrom, "00:00");
  const tomorrow = vnDateTime(addDays(today, 1), "00:00");
  const weekAhead = vnDateTime(addDays(today, 7), "00:00");
  const weekBack = vnDateTime(addDays(today, -6), "00:00");
  const longStart = vnDateTime(addDays(today, -90), "00:00");

  const [board, timeline, recon, attendance, heldMeetings, courseTeachers, loadMeetings] = await Promise.all([
    getOrgBoard(actorUserId, organizationId, { from: addDays(today, -6), to: addDays(today, 6) }, now, db),
    getOrgClassTimeline(actorUserId, organizationId, { from: addDays(today, -120), to: addDays(today, 120) }, now, db),
    getOrgReconciliation(actorUserId, organizationId, { from: winFrom, to: today }, now, db),
    db.studentAttendance.findMany({
      where: { meeting: { status: "held", startsAt: { gte: longStart, lt: tomorrow }, section: { course: { organizationId } } } },
      select: { meetingId: true, userId: true, status: true, meeting: { select: { sectionId: true, startsAt: true } } },
      take: ATTENDANCE_ROW_CAP,
    }),
    db.classMeeting.findMany({
      where: { status: "held", startsAt: { gte: winStart, lt: tomorrow }, section: { course: { organizationId } } },
      select: { id: true, sectionId: true },
    }),
    db.courseInstructor.findMany({
      where: { role: { in: ["non-editing-teacher", "co-instructor"] }, course: { organizationId } },
      select: { userId: true, user: { select: { displayName: true } } },
    }),
    db.classMeeting.findMany({
      where: { startsAt: { gte: winStart, lt: weekAhead }, section: { course: { organizationId } } },
      select: { plannedTeacherId: true, startsAt: true, endsAt: true, status: true, checkIn: { select: { teacherId: true } }, section: { select: { instructorId: true } } },
    }),
  ]);

  // 1. Hôm nay và các thẻ cảnh báo (cùng định nghĩa với bảng điều phối).
  const todayMeetings = board.meetings.filter((m) => vnDayKey(new Date(m.startsAt)) === today);
  const todayCounts = { total: todayMeetings.length, live: 0, upcoming: 0, held: 0, overdue: 0, cancelled: 0 };
  for (const m of todayMeetings) todayCounts[m.state]++;
  const at = (m: { startsAt: string }) => new Date(m.startsAt).getTime();
  const alerts: OverviewAlerts = {
    noTeacher: board.meetings.filter((m) => m.state !== "cancelled" && m.state !== "held" && at(m) >= now.getTime() - 3600_000 && at(m) < weekAhead.getTime() && m.flags.includes("no_teacher")).length,
    noCheckIn: todayMeetings.filter((m) => m.flags.includes("no_checkin")).length,
    noAttendance: board.meetings.filter((m) => at(m) >= weekBack.getTime() && at(m) < tomorrow.getTime() && m.flags.includes("no_attendance")).length,
    clashes: board.meetings.filter((m) => m.state !== "cancelled" && at(m) >= vnDateTime(today, "00:00").getTime() && (m.flags.includes("room_clash") || m.flags.includes("teacher_clash"))).length,
  };

  // 2. Lớp.
  const tallyBySection = new Map<string, { present: number; late: number; absent: number }>();
  const markedMeetings = new Set<string>();
  for (const a of attendance) {
    markedMeetings.add(a.meetingId);
    if (a.meeting.startsAt.getTime() < winStart.getTime() || a.status === "excused") continue;
    const t = tallyBySection.get(a.meeting.sectionId) ?? { present: 0, late: 0, absent: 0 };
    t[a.status as Exclude<AttendanceStatusValue, "excused">]++;
    tallyBySection.set(a.meeting.sectionId, t);
  }
  const unmarkedBySection = new Map<string, number>();
  for (const m of heldMeetings) if (!markedMeetings.has(m.id)) unmarkedBySection.set(m.sectionId, (unmarkedBySection.get(m.sectionId) ?? 0) + 1);
  const classes: OverviewClass[] = timeline.classes
    .filter((c) => c.lifecycle.status === "running" || c.lifecycle.status === "planned")
    .map((c) => {
      const att = classAttendance(tallyBySection.get(c.sectionId) ?? { present: 0, late: 0, absent: 0 }, th);
      return {
        sectionId: c.sectionId,
        name: c.name,
        courseId: c.courseId,
        courseTitle: c.courseTitle,
        level: c.level,
        teacher: c.teacher,
        enrolled: c.enrolled,
        held: c.lifecycle.held,
        total: c.lifecycle.total,
        status: c.lifecycle.status,
        end: c.lifecycle.end,
        attendanceRate: att.rate,
        attendanceLow: att.low,
        unmarked: c.enrolled > 0 ? (unmarkedBySection.get(c.sectionId) ?? 0) : 0,
        endingSoon: isEndingSoon(c.lifecycle, th),
        canManage: c.canManage,
      };
    })
    // Chuyên cần thấp trước (L3.1); lớp chưa đủ mẫu xuống cuối.
    .sort((a, b) => (a.attendanceRate ?? 2) - (b.attendanceRate ?? 2) || a.name.localeCompare(b.name, "vi"));

  // 3. Giáo viên: đối chiếu (tái dùng) + tải dạy.
  const taught = hoursByTeacher(loadMeetings.map((m) => ({ teacherId: m.checkIn?.teacherId ?? m.plannedTeacherId ?? m.section.instructorId, startsAt: m.startsAt, endsAt: m.endsAt, status: m.status })), { from: winStart, to: tomorrow }, "held");
  const planned = hoursByTeacher(loadMeetings.map((m) => ({ teacherId: m.plannedTeacherId ?? m.section.instructorId, startsAt: m.startsAt, endsAt: m.endsAt, status: m.status })), { from: vnDateTime(today, "00:00"), to: weekAhead }, "planned");
  const reconBy = new Map<string, TeacherTally>(recon.teachers.filter((t) => t.teacherId).map((t) => [t.teacherId!, t]));
  const names = new Map<string, string>(courseTeachers.map((c) => [c.userId, c.user.displayName]));
  for (const t of recon.teachers) if (t.teacherId) names.set(t.teacherId, t.name);
  const teacherIds = new Set<string>([...names.keys(), ...taught.keys(), ...planned.keys()]);
  const teachers: OverviewTeacher[] = [...teacherIds].map((id) => {
    const r = reconBy.get(id);
    const hoursTaught = taught.get(id) ?? 0;
    const hoursPlanned = planned.get(id) ?? 0;
    return {
      teacherId: id,
      name: names.get(id) ?? "Giáo viên",
      meetings: r?.meetings ?? 0,
      onTime: r?.onTime ?? 0,
      late: r?.late ?? 0,
      substitute: r?.substitute ?? 0,
      noCheckIn: r?.noCheckIn ?? 0,
      hoursTaught: Math.round(hoursTaught * 10) / 10,
      hoursPlanned: Math.round(hoursPlanned * 10) / 10,
      overloaded: hoursPlanned > th.overloadHoursPerWeek,
      unassigned: hoursTaught === 0 && hoursPlanned === 0,
    };
  });
  // Cần xếp lại trước (L2.3), rồi nhiều việc, rồi theo tên: đối chiếu để xếp dạy bù, không xếp hạng (L2.4).
  teachers.sort((a, b) => Number(b.unassigned) - Number(a.unassigned) || Number(b.overloaded) - Number(a.overloaded) || a.name.localeCompare(b.name, "vi"));

  // 4. Học viên cần liên hệ: chỉ học viên còn đang học ở lớp đó.
  const risk = findAtRisk(attendance.map((a) => ({ userId: a.userId, sectionId: a.meeting.sectionId, startsAt: a.meeting.startsAt, status: a.status as AttendanceStatusValue })), winStart, th);
  const sectionIds = [...new Set(risk.map((r) => r.sectionId))];
  const active = sectionIds.length
    ? await db.enrollment.findMany({ where: { sectionId: { in: sectionIds }, status: "active", userId: { in: [...new Set(risk.map((r) => r.userId))] } }, select: { userId: true, sectionId: true, user: { select: { displayName: true } }, section: { select: { name: true, courseId: true } } } })
    : [];
  const enrolledKey = new Map(active.map((e) => [`${e.userId}|${e.sectionId}`, e]));
  const kept = risk.filter((r) => enrolledKey.has(`${r.userId}|${r.sectionId}`));
  const atRisk: OverviewStudent[] = kept.slice(0, AT_RISK_LIMIT).map((r) => {
    const e = enrolledKey.get(`${r.userId}|${r.sectionId}`)!;
    return {
      userId: r.userId,
      name: e.user.displayName,
      sectionId: r.sectionId,
      sectionName: e.section!.name,
      courseId: e.section!.courseId,
      consecutive: r.consecutive,
      attendanceRate: r.rate,
      lastAbsentAt: r.lastAbsentAt?.toISOString() ?? null,
      reasons: r.reasons,
    };
  });

  return { organizationId, today, thresholds: th, todayCounts, alerts, teachers, classes, atRiskTotal: kept.length, atRisk };
}

/** Mở danh sách học viên cần liên hệ (L4.1): tối đa một sự kiện mỗi người, mỗi trường, mỗi ngày. Payload chỉ id và số dòng, không tên. */
export async function recordRiskListViewed(userId: string, organizationId: string, today: string, rowCount: number, db: DbClient = prisma): Promise<void> {
  await emitEvent(userId, LearningEventType.CenterRiskListViewed, { organizationId, rowCount }, { eventKey: `center.risk_list.viewed:${userId}:${organizationId}:${today}` }, db);
}
