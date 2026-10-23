/**
 * Điểm danh học viên theo buổi (CENTER C2 — docs/CENTER-schedule-attendance-AC.md).
 *
 * Luật chính:
 *   - Bảng StudentAttendance là trạng thái HIỆN TẠI; lịch sử sửa nằm ở event
 *     `attendance.student.marked` (có trạng thái cũ). Không có dòng = chưa đánh dấu, khác với vắng.
 *   - Cửa sổ ghi: từ 30 phút trước giờ bắt đầu đến 7 ngày sau giờ kết thúc. Ngoài cửa sổ vẫn xem được.
 *   - Danh sách lớp = học viên đang ghi danh vào lớp (Enrollment.sectionId, đang học hoặc đã hoàn thành)
 *     cộng những người đã có dòng điểm danh ở buổi đó (rời lớp rồi vẫn giữ lịch sử).
 *   - Học viên chỉ đọc được trạng thái của chính mình; ghi chú của giáo viên không bao giờ trả về cho học viên.
 *   - Event có subject là HỌC VIÊN được điểm danh; giáo viên thao tác nằm trong payload. Payload không mang ghi chú.
 */
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType, type AttendanceStatusValue } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { assertCanGradeCourse } from "./authz";
import { rangeBounds } from "./classSchedule";

export class AttendanceError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "meeting_not_found"
      | "section_not_found"
      | "meeting_cancelled"
      | "attendance_not_open"
      | "attendance_closed"
      | "not_in_roster",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

/** Mở điểm danh trước giờ bắt đầu bao nhiêu phút. */
export const ATTENDANCE_OPEN_BEFORE_MIN = 30;
/** Cho sửa điểm danh bao nhiêu ngày sau khi buổi kết thúc. */
export const ATTENDANCE_EDIT_AFTER_DAYS = 7;
/** Số buổi vắng liên tiếp (gần nhất) để đánh dấu giáo viên cần chú ý. */
export const ATTENTION_CONSECUTIVE_ABSENT = 2;

const COUNTED_ENROLLMENT = ["active", "completed"] as const;

// ── Kiểu trả về ──────────────────────────────────────────────────────────

export type AttendanceWindowState = "not_open" | "open" | "closed";

export interface AttendanceEntry {
  userId: string;
  displayName: string;
  email: string;
  /** null = chưa đánh dấu. */
  status: AttendanceStatusValue | null;
  note: string | null;
  markedAt: string | null;
  /** false = đã rời lớp nhưng còn dòng điểm danh ở buổi này. */
  inRoster: boolean;
}

export interface MeetingAttendanceView {
  meeting: {
    id: string;
    sectionId: string;
    sectionName: string;
    courseId: string;
    seq: number | null;
    startsAt: string;
    endsAt: string;
    room: string | null;
    status: "planned" | "held" | "cancelled";
  };
  window: { state: AttendanceWindowState; opensAt: string; closesAt: string };
  entries: AttendanceEntry[];
}

export interface LearnerAttendanceSummary {
  userId: string;
  displayName: string;
  email: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** (có mặt + muộn) / (có mặt + muộn + vắng); có phép không tính. null khi chưa có dữ liệu. */
  attendedRate: number | null;
  /** Số buổi vắng liên tiếp tính từ buổi gần nhất có đánh dấu. */
  consecutiveAbsent: number;
  needsAttention: boolean;
}

export interface SectionAttendanceSummary {
  /** Số buổi đã bắt đầu và không huỷ. */
  meetingsHeld: number;
  learners: LearnerAttendanceSummary[];
}

export interface MyAttendanceRow {
  meetingId: string;
  sectionId: string;
  status: AttendanceStatusValue;
}

export interface MyAttendanceSectionSummary {
  sectionId: string;
  sectionName: string;
  courseId: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
}

// ── Kiểm tra đầu vào ─────────────────────────────────────────────────────

const Status = z.enum(["present", "late", "absent", "excused"]);

const MarkInput = z
  .object({
    entries: z
      .array(
        z.object({
          userId: z.string().min(1),
          status: Status,
          note: z.string().trim().max(200).optional(),
        }),
      )
      .min(1)
      .max(300),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const e of v.entries) {
      if (seen.has(e.userId)) ctx.addIssue({ code: "custom", message: "duplicate_user", path: ["entries"] });
      seen.add(e.userId);
    }
  });

const RangeInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AttendanceError("validation_failed", r.error.flatten());
  return r.data;
}

// ── Tải & kiểm quyền ─────────────────────────────────────────────────────

async function loadMeeting(actorUserId: string, meetingId: string, db: DbClient) {
  const meeting = await db.classMeeting.findUnique({
    where: { id: meetingId },
    include: { section: { select: { id: true, name: true, courseId: true } } },
  });
  if (!meeting) throw new AttendanceError("meeting_not_found");
  await assertCanGradeCourse(actorUserId, meeting.section.courseId, db);
  return meeting;
}

type LoadedMeeting = Awaited<ReturnType<typeof loadMeeting>>;

function windowOf(meeting: { startsAt: Date; endsAt: Date }, now: Date) {
  const opensAt = new Date(meeting.startsAt.getTime() - ATTENDANCE_OPEN_BEFORE_MIN * 60_000);
  const closesAt = new Date(meeting.endsAt.getTime() + ATTENDANCE_EDIT_AFTER_DAYS * 86_400_000);
  const state: AttendanceWindowState =
    now.getTime() < opensAt.getTime() ? "not_open" : now.getTime() > closesAt.getTime() ? "closed" : "open";
  return { state, opensAt, closesAt };
}

function assertWritable(meeting: LoadedMeeting, now: Date) {
  if (meeting.status === "cancelled") throw new AttendanceError("meeting_cancelled");
  const w = windowOf(meeting, now);
  if (w.state === "not_open") throw new AttendanceError("attendance_not_open");
  if (w.state === "closed") throw new AttendanceError("attendance_closed");
}

async function currentRosterIds(sectionId: string, db: DbClient): Promise<string[]> {
  const rows = await db.enrollment.findMany({
    where: { sectionId, status: { in: [...COUNTED_ENROLLMENT] } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

// ── Đọc danh sách một buổi ───────────────────────────────────────────────

export async function getMeetingAttendance(
  actorUserId: string,
  meetingId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<MeetingAttendanceView> {
  const meeting = await loadMeeting(actorUserId, meetingId, db);
  const [enrolled, rows] = await Promise.all([
    db.enrollment.findMany({
      where: { sectionId: meeting.sectionId, status: { in: [...COUNTED_ENROLLMENT] } },
      select: { user: { select: { id: true, displayName: true, email: true } } },
    }),
    db.studentAttendance.findMany({
      where: { meetingId },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    }),
  ]);

  const byUser = new Map<string, AttendanceEntry>();
  for (const e of enrolled) {
    byUser.set(e.user.id, {
      userId: e.user.id,
      displayName: e.user.displayName,
      email: e.user.email,
      status: null,
      note: null,
      markedAt: null,
      inRoster: true,
    });
  }
  for (const r of rows) {
    const existing = byUser.get(r.userId);
    byUser.set(r.userId, {
      userId: r.userId,
      displayName: r.user.displayName,
      email: r.user.email,
      status: r.status,
      note: r.note,
      markedAt: r.markedAt.toISOString(),
      inRoster: existing?.inRoster ?? false,
    });
  }

  const w = windowOf(meeting, now);
  return {
    meeting: {
      id: meeting.id,
      sectionId: meeting.sectionId,
      sectionName: meeting.section.name,
      courseId: meeting.section.courseId,
      seq: meeting.seq,
      startsAt: meeting.startsAt.toISOString(),
      endsAt: meeting.endsAt.toISOString(),
      room: meeting.room,
      status: meeting.status,
    },
    window: { state: w.state, opensAt: w.opensAt.toISOString(), closesAt: w.closesAt.toISOString() },
    entries: [...byUser.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "vi")),
  };
}

// ── Ghi ──────────────────────────────────────────────────────────────────

/**
 * Đánh dấu một lô học viên. Cả lô hoặc không gì cả: một người không thuộc lớp thì không ghi ai.
 * `changed` đếm số người đổi trạng thái (kể cả lần đầu); chỉ đổi ghi chú thì cập nhật ghi chú nhưng
 * không tính và không phát event.
 */
export async function markAttendance(
  actorUserId: string,
  meetingId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<{ changed: number }> {
  const meeting = await loadMeeting(actorUserId, meetingId, db);
  const input = parse(MarkInput, rawInput);
  assertWritable(meeting, now);

  const [roster, existingRows] = await Promise.all([
    currentRosterIds(meeting.sectionId, db),
    db.studentAttendance.findMany({ where: { meetingId } }),
  ]);
  const allowed = new Set([...roster, ...existingRows.map((r) => r.userId)]);
  if (input.entries.some((e) => !allowed.has(e.userId))) throw new AttendanceError("not_in_roster");
  const existing = new Map(existingRows.map((r) => [r.userId, r]));

  return db.$transaction(
    async (tx) => {
      let changed = 0;
      for (const e of input.entries) {
        const old = existing.get(e.userId);
        const note = e.note === undefined ? undefined : e.note === "" ? null : e.note;
        if (!old) {
          await tx.studentAttendance.create({
            data: { meetingId, userId: e.userId, status: e.status, note: note ?? null, markedById: actorUserId, markedAt: now },
          });
          await emitMarked(tx, actorUserId, meeting, e.userId, e.status, null);
          changed++;
        } else if (old.status !== e.status) {
          await tx.studentAttendance.update({
            where: { id: old.id },
            data: { status: e.status, ...(note !== undefined ? { note } : {}), markedById: actorUserId, markedAt: now },
          });
          await emitMarked(tx, actorUserId, meeting, e.userId, e.status, old.status);
          changed++;
        } else if (note !== undefined && note !== old.note) {
          await tx.studentAttendance.update({ where: { id: old.id }, data: { note } });
        }
      }
      return { changed };
    },
    { timeout: 30_000 },
  );
}

/** Đánh dấu "có mặt" cho mọi học viên đang trong lớp mà chưa có dòng; người đã đánh dấu giữ nguyên. */
export async function markAllPresent(
  actorUserId: string,
  meetingId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<{ marked: number }> {
  const meeting = await loadMeeting(actorUserId, meetingId, db);
  assertWritable(meeting, now);

  const [roster, existingRows] = await Promise.all([
    currentRosterIds(meeting.sectionId, db),
    db.studentAttendance.findMany({ where: { meetingId }, select: { userId: true } }),
  ]);
  const done = new Set(existingRows.map((r) => r.userId));
  const todo = roster.filter((id) => !done.has(id));
  if (todo.length === 0) return { marked: 0 };

  return db.$transaction(
    async (tx) => {
      for (const userId of todo) {
        await tx.studentAttendance.create({
          data: { meetingId, userId, status: "present", markedById: actorUserId, markedAt: now },
        });
        await emitMarked(tx, actorUserId, meeting, userId, "present", null);
      }
      return { marked: todo.length };
    },
    { timeout: 30_000 },
  );
}

async function emitMarked(
  tx: DbClient,
  actorUserId: string,
  meeting: LoadedMeeting,
  userId: string,
  status: AttendanceStatusValue,
  previousStatus: AttendanceStatusValue | null,
) {
  await emitEvent(
    userId,
    LearningEventType.AttendanceStudentMarked,
    {
      meetingId: meeting.id,
      sectionId: meeting.sectionId,
      courseId: meeting.section.courseId,
      status,
      previousStatus,
      markedById: actorUserId,
    },
    { courseId: meeting.section.courseId },
    tx,
  );
}

// ── Tổng hợp theo lớp (giáo viên) ────────────────────────────────────────

export async function getSectionAttendanceSummary(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<SectionAttendanceSummary> {
  const section = await db.courseSection.findUnique({ where: { id: sectionId }, select: { courseId: true } });
  if (!section) throw new AttendanceError("section_not_found");
  await assertCanGradeCourse(actorUserId, section.courseId, db);

  const [meetings, enrolled] = await Promise.all([
    db.classMeeting.findMany({
      where: { sectionId, status: { not: "cancelled" }, startsAt: { lte: now } },
      orderBy: { startsAt: "asc" },
      select: { id: true },
    }),
    db.enrollment.findMany({
      where: { sectionId, status: { in: [...COUNTED_ENROLLMENT] } },
      select: { user: { select: { id: true, displayName: true, email: true } } },
    }),
  ]);
  const meetingIds = meetings.map((m) => m.id);
  const rows =
    meetingIds.length === 0
      ? []
      : await db.studentAttendance.findMany({
          where: { meetingId: { in: meetingIds }, userId: { in: enrolled.map((e) => e.user.id) } },
          select: { meetingId: true, userId: true, status: true },
        });
  const byUser = new Map<string, Map<string, AttendanceStatusValue>>();
  for (const r of rows) {
    const m = byUser.get(r.userId) ?? new Map<string, AttendanceStatusValue>();
    m.set(r.meetingId, r.status);
    byUser.set(r.userId, m);
  }

  const learners = enrolled
    .map(({ user }): LearnerAttendanceSummary => {
      const mine = byUser.get(user.id) ?? new Map<string, AttendanceStatusValue>();
      const count = (s: AttendanceStatusValue) => [...mine.values()].filter((v) => v === s).length;
      const present = count("present");
      const late = count("late");
      const absent = count("absent");
      const excused = count("excused");
      const denom = present + late + absent;
      // Từ buổi gần nhất lùi về; buổi chưa đánh dấu bị bỏ qua, có mặt/muộn/có phép cắt chuỗi.
      let consecutiveAbsent = 0;
      for (let i = meetingIds.length - 1; i >= 0; i--) {
        const s = mine.get(meetingIds[i]!);
        if (!s) continue;
        if (s !== "absent") break;
        consecutiveAbsent++;
      }
      return {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        present,
        late,
        absent,
        excused,
        attendedRate: denom === 0 ? null : (present + late) / denom,
        consecutiveAbsent,
        needsAttention: consecutiveAbsent >= ATTENTION_CONSECUTIVE_ABSENT,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));

  return { meetingsHeld: meetings.length, learners };
}

// ── Học viên xem của chính mình ──────────────────────────────────────────

/** Trạng thái điểm danh của chính người này theo khoảng ngày. Không bao giờ có ghi chú của giáo viên. */
export async function listMyAttendance(
  userId: string,
  rawRange: unknown,
  db: PrismaClient = prisma,
): Promise<MyAttendanceRow[]> {
  const range = parse(RangeInput, rawRange);
  const { start, end } = rangeBounds(range.from, range.to);
  const rows = await db.studentAttendance.findMany({
    where: { userId, meeting: { startsAt: { gte: start, lt: end } } },
    orderBy: { meeting: { startsAt: "asc" } },
    select: { status: true, meetingId: true, meeting: { select: { sectionId: true } } },
  });
  return rows.map((r) => ({ meetingId: r.meetingId, sectionId: r.meeting.sectionId, status: r.status }));
}

export async function getMyAttendanceSummary(
  userId: string,
  db: PrismaClient = prisma,
): Promise<MyAttendanceSectionSummary[]> {
  const rows = await db.studentAttendance.findMany({
    where: { userId },
    select: { status: true, meeting: { select: { sectionId: true, section: { select: { name: true, courseId: true } } } } },
  });
  const bySection = new Map<string, MyAttendanceSectionSummary>();
  for (const r of rows) {
    const id = r.meeting.sectionId;
    const sum =
      bySection.get(id) ??
      { sectionId: id, sectionName: r.meeting.section.name, courseId: r.meeting.section.courseId, present: 0, late: 0, absent: 0, excused: 0 };
    sum[r.status]++;
    bySection.set(id, sum);
  }
  return [...bySection.values()].sort((a, b) => a.sectionName.localeCompare(b.sectionName, "vi"));
}
