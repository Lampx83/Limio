/**
 * Lịch dạy của lớp và các buổi học (CENTER C1 — docs/CENTER-schedule-attendance-AC.md).
 *
 * Mô hình:
 *   - ClassSchedule + ClassScheduleSlot là KẾ HOẠCH: ngày bắt đầu, tổng số buổi, các khung hằng tuần.
 *   - ClassMeeting là từng buổi sinh ra từ kế hoạch; là thứ được điểm danh, huỷ, dạy bù.
 *
 * Luật chính:
 *   - Áp (lại) kế hoạch chỉ đụng buổi `planned`, còn ở tương lai, chưa bị khoá và chưa có điểm danh. Buổi đã dạy, đã huỷ,
 *     đã qua, buổi dạy bù và buổi sửa lẻ đều giữ nguyên.
 *   - `seq` là số thứ tự trong giáo án: chỉ buổi không huỷ có, đánh theo thời gian từ 1. Huỷ hay chèn
 *     dạy bù thì đánh số lại, nên giáo án luôn đi theo thứ tự dạy thật.
 *   - Trùng giáo viên / trùng phòng chỉ CẢNH BÁO (trung tâm nhỏ có thể dạy ghép), không chặn.
 *   - Mỗi thao tác ghi cùng một transaction với event tương ứng (CLAUDE.md §5.1).
 */
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { assertCanGradeCourse } from "./authz";
import {
  addDays,
  generateMeetings,
  overlaps,
  vnDateTime,
  vnDayKey,
  type SlotInput,
} from "./classScheduleCalc";

export class ClassScheduleError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "section_not_found"
      | "default_section"
      | "meeting_not_found"
      | "meeting_not_editable"
      | "already_cancelled"
      | "makeup_of_invalid"
      | "teacher_not_in_course",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// ── Kiểu trả về ──────────────────────────────────────────────────────────

export interface ScheduleConflict {
  kind: "teacher" | "room";
  meetingId: string;
  otherMeetingId: string;
  otherSectionName: string;
  /** Giờ bắt đầu của buổi bị trùng (ISO). */
  startsAt: string;
}

export interface MeetingItem {
  id: string;
  sectionId: string;
  sectionName: string;
  courseId: string;
  seq: number | null;
  startsAt: string;
  endsAt: string;
  room: string | null;
  plannedTeacherId: string | null;
  plannedTeacherName: string | null;
  status: "planned" | "held" | "cancelled";
  cancelReason: string | null;
  makeupOfId: string | null;
  locked: boolean;
}

export interface ClassScheduleView {
  startDate: string;
  totalMeetings: number;
  slots: Array<{
    weekday: number;
    startTime: string;
    durationMin: number;
    room: string | null;
    plannedTeacherId: string | null;
  }>;
}

export interface ApplyScheduleResult {
  created: number;
  updated: number;
  removed: number;
  conflicts: ScheduleConflict[];
}

export interface ClassScheduleDetail {
  schedule: ClassScheduleView | null;
  meetings: MeetingItem[];
  /** Số buổi học thật (không tính buổi huỷ). */
  countedMeetings: number;
  /** Còn thiếu bao nhiêu buổi so với kế hoạch (0 nếu đủ hoặc dư). */
  shortBy: number;
}

// ── Kiểm tra đầu vào ─────────────────────────────────────────────────────

const DayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const HHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Room = z
  .string()
  .max(100)
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : null));

const SlotSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startTime: HHmm,
  durationMin: z.number().int().min(15).max(480),
  room: Room,
  plannedTeacherId: z.string().min(1).nullish().transform((v) => v ?? null),
});

const ScheduleInput = z
  .object({
    startDate: DayKey,
    totalMeetings: z.number().int().min(1).max(200),
    slots: z.array(SlotSchema).min(1).max(14),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const s of v.slots) {
      const key = `${s.weekday}@${s.startTime}`;
      if (seen.has(key)) ctx.addIssue({ code: "custom", message: "duplicate_slot", path: ["slots"] });
      seen.add(key);
    }
    if (Number.isNaN(new Date(`${v.startDate}T00:00:00Z`).getTime())) {
      ctx.addIssue({ code: "custom", message: "bad_date", path: ["startDate"] });
    }
  });

const CancelInput = z.object({ reason: z.string().trim().min(1).max(500) });

const MakeupInput = z.object({
  startsAt: z.string().datetime(),
  durationMin: z.number().int().min(15).max(480),
  room: Room,
  plannedTeacherId: z.string().min(1).nullish().transform((v) => v ?? null),
  makeupOfId: z.string().min(1).nullish().transform((v) => v ?? null),
});

const UpdateInput = z
  .object({
    startsAt: z.string().datetime().optional(),
    durationMin: z.number().int().min(15).max(480).optional(),
    room: Room.optional(),
    plannedTeacherId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "empty_update" });

const RangeInput = z.object({
  from: DayKey,
  to: DayKey,
  sectionId: z.string().min(1).optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ClassScheduleError("validation_failed", r.error.flatten());
  return r.data;
}

// ── Tải & kiểm quyền ─────────────────────────────────────────────────────

async function loadSection(sectionId: string, db: DbClient) {
  const section = await db.courseSection.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true, courseId: true, isDefault: true, instructorId: true },
  });
  if (!section) throw new ClassScheduleError("section_not_found");
  return section;
}

async function loadManageableSection(actorUserId: string, sectionId: string, db: DbClient) {
  const section = await loadSection(sectionId, db);
  await assertCanGradeCourse(actorUserId, section.courseId, db);
  if (section.isDefault) throw new ClassScheduleError("default_section");
  return section;
}

async function loadManageableMeeting(actorUserId: string, meetingId: string, db: DbClient) {
  const meeting = await db.classMeeting.findUnique({
    where: { id: meetingId },
    include: { section: { select: { id: true, name: true, courseId: true } } },
  });
  if (!meeting) throw new ClassScheduleError("meeting_not_found");
  await assertCanGradeCourse(actorUserId, meeting.section.courseId, db);
  return meeting;
}

/** Giáo viên dự kiến phải là người dạy khoá này (hoặc giáo viên phụ trách lớp). */
async function assertTeachersInCourse(
  courseId: string,
  sectionInstructorId: string | null,
  teacherIds: ReadonlyArray<string | null | undefined>,
  db: DbClient,
): Promise<void> {
  const ids = [...new Set(teacherIds.filter((t): t is string => !!t))];
  if (ids.length === 0) return;
  const rows = await db.courseInstructor.findMany({
    where: { courseId, userId: { in: ids } },
    select: { userId: true },
  });
  const ok = new Set(rows.map((r) => r.userId));
  if (sectionInstructorId) ok.add(sectionInstructorId);
  if (ids.some((id) => !ok.has(id))) throw new ClassScheduleError("teacher_not_in_course");
}

// ── Chuyển đổi ───────────────────────────────────────────────────────────

type MeetingRow = {
  id: string;
  sectionId: string;
  seq: number | null;
  startsAt: Date;
  endsAt: Date;
  room: string | null;
  plannedTeacherId: string | null;
  status: "planned" | "held" | "cancelled";
  cancelReason: string | null;
  makeupOfId: string | null;
  locked: boolean;
  section?: { name: string; courseId: string };
  plannedTeacher?: { displayName: string } | null;
};

function toItem(m: MeetingRow, sectionName?: string): MeetingItem {
  return {
    id: m.id,
    sectionId: m.sectionId,
    sectionName: sectionName ?? m.section?.name ?? "",
    courseId: m.section?.courseId ?? "",
    seq: m.seq,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt.toISOString(),
    room: m.room,
    plannedTeacherId: m.plannedTeacherId,
    plannedTeacherName: m.plannedTeacher?.displayName ?? null,
    status: m.status,
    cancelReason: m.cancelReason,
    makeupOfId: m.makeupOfId,
    locked: m.locked,
  };
}

const MEETING_INCLUDE = {
  section: { select: { name: true, courseId: true } },
  plannedTeacher: { select: { displayName: true } },
} as const;

const normRoom = (r: string | null) => (r && r.trim() ? r.trim().toLowerCase() : null);

// ── Đánh số & phát hiện trùng ────────────────────────────────────────────

/** Đánh lại `seq` cho cả lớp: buổi không huỷ 1..N theo thời gian, buổi huỷ = null. */
async function renumber(sectionId: string, db: DbClient): Promise<void> {
  const rows = await db.classMeeting.findMany({
    where: { sectionId },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, seq: true, status: true },
  });
  let next = 1;
  for (const r of rows) {
    const want = r.status === "cancelled" ? null : next++;
    if (r.seq !== want) await db.classMeeting.update({ where: { id: r.id }, data: { seq: want } });
  }
}

/** Cảnh báo trùng giáo viên / phòng giữa các buổi vừa ghi và buổi của lớp khác. */
async function findConflicts(meetingIds: readonly string[], db: DbClient): Promise<ScheduleConflict[]> {
  if (meetingIds.length === 0) return [];
  const mine = await db.classMeeting.findMany({
    where: { id: { in: [...meetingIds] }, status: { not: "cancelled" } },
  });
  if (mine.length === 0) return [];
  const minStart = new Date(Math.min(...mine.map((m) => m.startsAt.getTime())));
  const maxEnd = new Date(Math.max(...mine.map((m) => m.endsAt.getTime())));
  const others = await db.classMeeting.findMany({
    where: {
      id: { notIn: [...meetingIds] },
      status: { not: "cancelled" },
      startsAt: { lt: maxEnd },
      endsAt: { gt: minStart },
    },
    include: { section: { select: { name: true } } },
  });
  const out: ScheduleConflict[] = [];
  for (const m of mine) {
    for (const o of others) {
      if (!overlaps(m, o)) continue;
      const base = {
        meetingId: m.id,
        otherMeetingId: o.id,
        otherSectionName: o.section.name,
        startsAt: m.startsAt.toISOString(),
      };
      if (m.plannedTeacherId && m.plannedTeacherId === o.plannedTeacherId) out.push({ kind: "teacher", ...base });
      const room = normRoom(m.room);
      if (room && room === normRoom(o.room)) out.push({ kind: "room", ...base });
    }
  }
  return out;
}

// ── Ghi ──────────────────────────────────────────────────────────────────

/**
 * Đặt hoặc đổi kế hoạch của lớp rồi sinh buổi. Idempotent: áp lại cùng kế hoạch không tạo trùng và
 * giữ nguyên id buổi. `now` nhận từ ngoài để test không phụ thuộc đồng hồ.
 */
export async function setClassSchedule(
  actorUserId: string,
  sectionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<ApplyScheduleResult> {
  const section = await loadManageableSection(actorUserId, sectionId, db);
  const input = parse(ScheduleInput, rawInput);
  await assertTeachersInCourse(section.courseId, section.instructorId, input.slots.map((s) => s.plannedTeacherId), db);

  return db.$transaction(
    async (tx) => {
      const schedule = await tx.classSchedule.upsert({
        where: { sectionId },
        update: { startDate: new Date(`${input.startDate}T00:00:00Z`), totalMeetings: input.totalMeetings },
        create: { sectionId, startDate: new Date(`${input.startDate}T00:00:00Z`), totalMeetings: input.totalMeetings },
      });
      await tx.classScheduleSlot.deleteMany({ where: { scheduleId: schedule.id } });
      await tx.classScheduleSlot.createMany({
        data: input.slots.map((s) => ({ scheduleId: schedule.id, ...s })),
      });

      const existing = await tx.classMeeting.findMany({
        where: { sectionId },
        include: { _count: { select: { attendance: true } } },
      });
      // Buổi đã có điểm danh không bao giờ bị thay: xoá buổi sẽ kéo theo mất điểm danh.
      const isReplaceable = (m: (typeof existing)[number]) =>
        m.status === "planned" &&
        !m.locked &&
        m._count.attendance === 0 &&
        m.startsAt.getTime() > now.getTime();
      const replaceable = existing.filter(isReplaceable);
      const kept = existing.filter((m) => !isReplaceable(m));
      const keptCounted = kept.filter((m) => m.status !== "cancelled").length;

      const desired = generateMeetings({
        startDay: input.startDate,
        // Lần đầu sinh cả buổi đã qua (lớp khai báo muộn); các lần sau không sinh thêm vào quá khứ.
        notBefore: existing.length === 0 ? undefined : vnDayKey(now),
        need: Math.max(0, input.totalMeetings - keptCounted),
        slots: input.slots as SlotInput[],
        occupied: new Set(kept.map((m) => m.startsAt.getTime())),
      });

      const oldByStart = new Map(replaceable.map((m) => [m.startsAt.getTime(), m]));
      const touched: string[] = [];
      let created = 0;
      let updated = 0;
      for (const d of desired) {
        const old = oldByStart.get(d.startsAt.getTime());
        if (old) {
          oldByStart.delete(d.startsAt.getTime());
          const changed =
            old.endsAt.getTime() !== d.endsAt.getTime() ||
            old.room !== d.room ||
            old.plannedTeacherId !== d.plannedTeacherId;
          if (changed) {
            await tx.classMeeting.update({
              where: { id: old.id },
              data: { endsAt: d.endsAt, room: d.room, plannedTeacherId: d.plannedTeacherId },
            });
            updated++;
            touched.push(old.id);
          }
        } else {
          const row = await tx.classMeeting.create({
            data: {
              sectionId,
              startsAt: d.startsAt,
              endsAt: d.endsAt,
              room: d.room,
              plannedTeacherId: d.plannedTeacherId,
            },
          });
          created++;
          touched.push(row.id);
        }
      }
      const toRemove = [...oldByStart.values()];
      if (toRemove.length > 0) {
        await tx.classMeeting.deleteMany({ where: { id: { in: toRemove.map((m) => m.id) } } });
      }

      await renumber(sectionId, tx);
      const conflicts = await findConflicts(touched, tx);

      await emitEvent(
        actorUserId,
        LearningEventType.ClassScheduleSet,
        {
          sectionId,
          courseId: section.courseId,
          totalMeetings: input.totalMeetings,
          slotCount: input.slots.length,
          created,
          updated,
          removed: toRemove.length,
        },
        { courseId: section.courseId },
        tx,
      );
      return { created, updated, removed: toRemove.length, conflicts };
    },
    { timeout: 30_000 },
  );
}

export async function cancelMeeting(
  actorUserId: string,
  meetingId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const meeting = await loadManageableMeeting(actorUserId, meetingId, db);
  const { reason } = parse(CancelInput, rawInput);
  if (meeting.status === "cancelled") throw new ClassScheduleError("already_cancelled");
  if (meeting.status === "held") throw new ClassScheduleError("meeting_not_editable");

  await db.$transaction(
    async (tx) => {
      await tx.classMeeting.update({
        where: { id: meetingId },
        data: { status: "cancelled", cancelReason: reason, seq: null },
      });
      await renumber(meeting.sectionId, tx);
      await emitEvent(
        actorUserId,
        LearningEventType.ClassMeetingCancelled,
        {
          meetingId,
          sectionId: meeting.sectionId,
          courseId: meeting.section.courseId,
          // Chỉ độ dài, không mang chữ lý do.
          reasonLength: reason.length,
        },
        { courseId: meeting.section.courseId },
        tx,
      );
    },
    { timeout: 30_000 },
  );
}

export async function addMakeupMeeting(
  actorUserId: string,
  sectionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ meeting: MeetingItem; conflicts: ScheduleConflict[] }> {
  const section = await loadManageableSection(actorUserId, sectionId, db);
  const input = parse(MakeupInput, rawInput);
  await assertTeachersInCourse(section.courseId, section.instructorId, [input.plannedTeacherId], db);

  if (input.makeupOfId) {
    const target = await db.classMeeting.findUnique({
      where: { id: input.makeupOfId },
      select: { sectionId: true, status: true },
    });
    if (!target || target.sectionId !== sectionId || target.status !== "cancelled") {
      throw new ClassScheduleError("makeup_of_invalid");
    }
  }

  const startsAt = new Date(input.startsAt);
  return db.$transaction(
    async (tx) => {
      const row = await tx.classMeeting.create({
        data: {
          sectionId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + input.durationMin * 60_000),
          room: input.room,
          plannedTeacherId: input.plannedTeacherId,
          makeupOfId: input.makeupOfId,
          locked: true,
        },
      });
      await renumber(sectionId, tx);
      const conflicts = await findConflicts([row.id], tx);
      await emitEvent(
        actorUserId,
        LearningEventType.ClassMeetingMakeupAdded,
        { meetingId: row.id, sectionId, courseId: section.courseId, makeupOfId: input.makeupOfId },
        { courseId: section.courseId },
        tx,
      );
      const fresh = await tx.classMeeting.findUniqueOrThrow({ where: { id: row.id }, include: MEETING_INCLUDE });
      return { meeting: toItem(fresh), conflicts };
    },
    { timeout: 30_000 },
  );
}

/** Sửa một buổi lẻ (giờ, thời lượng, phòng, giáo viên dự kiến). Buổi được khoá để áp lại kế hoạch không ghi đè. */
export async function updateMeeting(
  actorUserId: string,
  meetingId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ meeting: MeetingItem; conflicts: ScheduleConflict[] }> {
  const meeting = await loadManageableMeeting(actorUserId, meetingId, db);
  const input = parse(UpdateInput, rawInput);
  if (meeting.status !== "planned") throw new ClassScheduleError("meeting_not_editable");
  if (input.plannedTeacherId) {
    const sec = await loadSection(meeting.sectionId, db);
    await assertTeachersInCourse(meeting.section.courseId, sec.instructorId, [input.plannedTeacherId], db);
  }

  const oldDuration = meeting.endsAt.getTime() - meeting.startsAt.getTime();
  const startsAt = input.startsAt ? new Date(input.startsAt) : meeting.startsAt;
  const endsAt = new Date(startsAt.getTime() + (input.durationMin ? input.durationMin * 60_000 : oldDuration));

  const changed: string[] = [];
  if (startsAt.getTime() !== meeting.startsAt.getTime()) changed.push("startsAt");
  if (endsAt.getTime() !== meeting.endsAt.getTime()) changed.push("endsAt");
  if (input.room !== undefined && input.room !== meeting.room) changed.push("room");
  if (input.plannedTeacherId !== undefined && input.plannedTeacherId !== meeting.plannedTeacherId) {
    changed.push("plannedTeacherId");
  }

  return db.$transaction(
    async (tx) => {
      await tx.classMeeting.update({
        where: { id: meetingId },
        data: {
          startsAt,
          endsAt,
          ...(input.room !== undefined ? { room: input.room } : {}),
          ...(input.plannedTeacherId !== undefined ? { plannedTeacherId: input.plannedTeacherId } : {}),
          locked: true,
        },
      });
      await renumber(meeting.sectionId, tx);
      const conflicts = await findConflicts([meetingId], tx);
      await emitEvent(
        actorUserId,
        LearningEventType.ClassMeetingUpdated,
        { meetingId, sectionId: meeting.sectionId, courseId: meeting.section.courseId, changed },
        { courseId: meeting.section.courseId },
        tx,
      );
      const fresh = await tx.classMeeting.findUniqueOrThrow({ where: { id: meetingId }, include: MEETING_INCLUDE });
      return { meeting: toItem(fresh), conflicts };
    },
    { timeout: 30_000 },
  );
}

// ── Đọc ──────────────────────────────────────────────────────────────────

export async function getClassSchedule(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient = prisma,
): Promise<ClassScheduleDetail> {
  const section = await loadSection(sectionId, db);
  await assertCanGradeCourse(actorUserId, section.courseId, db);

  const [schedule, meetings] = await Promise.all([
    db.classSchedule.findUnique({ where: { sectionId }, include: { slots: true } }),
    db.classMeeting.findMany({
      where: { sectionId },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      include: MEETING_INCLUDE,
    }),
  ]);
  const countedMeetings = meetings.filter((m) => m.status !== "cancelled").length;
  return {
    schedule: schedule
      ? {
          startDate: schedule.startDate.toISOString().slice(0, 10),
          totalMeetings: schedule.totalMeetings,
          slots: [...schedule.slots]
            .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
            .map((s) => ({
              weekday: s.weekday,
              startTime: s.startTime,
              durationMin: s.durationMin,
              room: s.room,
              plannedTeacherId: s.plannedTeacherId,
            })),
        }
      : null,
    meetings: meetings.map((m) => toItem(m)),
    countedMeetings,
    shortBy: schedule ? Math.max(0, schedule.totalMeetings - countedMeetings) : 0,
  };
}

export function rangeBounds(from: string, to: string) {
  const start = vnDateTime(from, "00:00");
  const end = vnDateTime(addDays(to, 1), "00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new ClassScheduleError("validation_failed", "bad_range");
  }
  // Trần ~13 tháng để một lần gọi không kéo cả đời lớp.
  if (end.getTime() - start.getTime() > 400 * 24 * 3600_000) {
    throw new ClassScheduleError("validation_failed", "range_too_long");
  }
  return { start, end };
}

/** Lịch của giảng viên: mọi buổi của các lớp thuộc khoá mà người này đang dạy, theo khoảng ngày (giờ VN). */
export async function listTeacherMeetings(
  userId: string,
  rawRange: unknown,
  db: PrismaClient = prisma,
): Promise<MeetingItem[]> {
  const range = parse(RangeInput, rawRange);
  const { start, end } = rangeBounds(range.from, range.to);
  const rows = await db.classMeeting.findMany({
    where: {
      startsAt: { gte: start, lt: end },
      ...(range.sectionId ? { sectionId: range.sectionId } : {}),
      section: { course: { instructors: { some: { userId } } } },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    include: MEETING_INCLUDE,
  });
  return rows.map((m) => toItem(m));
}

/** Lịch của học viên: các buổi của lớp mình đang học (buổi huỷ vẫn hiện để biết là đã huỷ). */
export async function listLearnerMeetings(
  userId: string,
  rawRange: unknown,
  db: PrismaClient = prisma,
): Promise<MeetingItem[]> {
  const range = parse(RangeInput, rawRange);
  const { start, end } = rangeBounds(range.from, range.to);
  const rows = await db.classMeeting.findMany({
    where: {
      startsAt: { gte: start, lt: end },
      section: { enrollments: { some: { userId, status: { in: ["active", "completed"] } } } },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    include: MEETING_INCLUDE,
  });
  return rows.map((m) => toItem(m));
}
