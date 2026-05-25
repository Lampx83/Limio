/**
 * A5.2 — Cohort + ExamSchedule services (P1.5 T4-D2).
 *
 * Cohort = administrative grouping (lớp K65A-DSAI-2025-2). Separate from
 * Enrollment so a learner can be in multiple cohorts of the same course
 * (decision #2 in PLAN-A5).
 *
 * ExamSchedule = per-cohort open/close window + optional duration override.
 * Used to gate startExamAttempt instead of the simpler Exam.openAt/closeAt.
 */

import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { isUserEnrolled } from "../learning/enroll";
import { ensureDefaultRound, ensureDefaultRoomForSession } from "./exam-rooms";
import { ExamError } from "./types";

// ============================================================================
// Cohort CRUD
// ============================================================================

export const CreateCohortInput = z.object({
  name: z.string().min(1).max(200).trim(),
  // PR2.12 — Mã lớp do trường định nghĩa (6-8 ký tự, uppercase). SV gõ mã này
  // ở form open-mode. Unique trong course.
  code: z.string().min(4).max(16).trim().optional(),
  // PR2.12 — GV phụ trách lớp (1 GV : N cohort).
  instructorId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
});

export async function createCohort(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = CreateCohortInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  try {
    const c = await db.cohort.create({
      data: {
        courseId,
        name: parsed.data.name,
        code: parsed.data.code ? parsed.data.code.toUpperCase() : null,
        instructorId: parsed.data.instructorId ?? null,
        description: parsed.data.description ?? null,
      },
      select: { id: true },
    });
    return c;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new ExamError("cohort_name_taken");
    }
    throw e;
  }
}

export interface CohortExamClassItem {
  id: string;
  code: string;
  roomLocation: string | null;
  expectedStudentCount: number | null;
  actualCandidateCount: number;
  // PR2.18 — Per-session room instances ứng với examClass code này.
  rooms: Array<{
    roomId: string;
    sessionId: string;
    sessionCode: string | null;
    sessionTitle: string | null;
    locationNote: string | null;
    proctorUserId: string;
    proctorName: string;
    sourceRowNum: number | null;
  }>;
}

export interface CohortListItem {
  id: string;
  name: string;
  code: string | null;
  instructorId: string | null;
  instructorName: string | null;
  description: string | null;
  examClasses: CohortExamClassItem[];
  memberCount: number;
  scheduleCount: number;
  createdAt: string;
}

export async function listCohorts(
  actorUserId: string,
  courseId: string,
  options: { roundId?: string } = {},
  db: PrismaClient = prisma,
): Promise<CohortListItem[]> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const rows = await db.cohort.findMany({
    where: { courseId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      instructorId: true,
      description: true,
      createdAt: true,
      instructor: { select: { displayName: true } },
      examClasses: {
        select: {
          id: true,
          code: true,
          roomLocation: true,
          expectedStudentCount: true,
        },
        orderBy: { code: "asc" },
      },
      _count: { select: { members: true, schedules: true } },
    },
  });
  // PR2.16+PR2.18 — Resolve ExamRoom instances per examClass code. Aggregate
  // candidate counts AND collect per-session room info (id, session, proctor).
  // Scoped to course; if roundId provided, restrict rooms to that round.
  const allCodes = Array.from(
    new Set(rows.flatMap((r) => r.examClasses.map((ec) => ec.code))),
  );
  const candidateCounts = new Map<string, number>();
  const roomsByCode = new Map<string, CohortExamClassItem["rooms"]>();
  if (allCodes.length > 0) {
    const rooms = await db.examRoom.findMany({
      where: {
        name: { in: allCodes },
        exam: { courseId },
        ...(options.roundId ? { session: { roundId: options.roundId } } : {}),
      },
      select: {
        id: true,
        name: true,
        locationNote: true,
        sourceRowNum: true,
        proctorUserId: true,
        proctor: { select: { displayName: true } },
        sessionId: true,
        session: { select: { code: true, title: true } },
        _count: { select: { candidates: true } },
      },
    });
    for (const room of rooms) {
      candidateCounts.set(
        room.name,
        (candidateCounts.get(room.name) ?? 0) + room._count.candidates,
      );
      const existing = roomsByCode.get(room.name) ?? [];
      existing.push({
        roomId: room.id,
        sessionId: room.sessionId,
        sessionCode: room.session.code,
        sessionTitle: room.session.title,
        locationNote: room.locationNote,
        proctorUserId: room.proctorUserId,
        proctorName: room.proctor.displayName,
        sourceRowNum: room.sourceRowNum,
      });
      roomsByCode.set(room.name, existing);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    instructorId: r.instructorId,
    instructorName: r.instructor?.displayName ?? null,
    description: r.description,
    examClasses: r.examClasses.map((ec) => ({
      ...ec,
      actualCandidateCount: candidateCounts.get(ec.code) ?? 0,
      rooms: roomsByCode.get(ec.code) ?? [],
    })),
    memberCount: r._count.members,
    scheduleCount: r._count.schedules,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ============================================================================
// CohortExamClass CRUD (PR2.15)
// ============================================================================

export const AddExamClassInput = z.object({
  code: z.string().min(1).max(32).trim(),
  roomLocation: z.string().max(200).optional().nullable(),
});

export async function addCohortExamClass(
  actorUserId: string,
  cohortId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string; code: string; roomLocation: string | null }> {
  const cohort = await assertCanEditCohort(actorUserId, cohortId, db);
  const parsed = AddExamClassInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  try {
    const row = await db.cohortExamClass.create({
      data: {
        cohortId,
        courseId: cohort.courseId,
        code: parsed.data.code.toUpperCase(),
        roomLocation: parsed.data.roomLocation?.trim() || null,
      },
      select: { id: true, code: true, roomLocation: true },
    });
    return row;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("validation_failed", { reason: "code_taken" });
    throw e;
  }
}

export async function deleteCohortExamClass(
  actorUserId: string,
  examClassId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const row = await db.cohortExamClass.findUnique({
    where: { id: examClassId },
    select: { cohortId: true },
  });
  if (!row)
    throw new ExamError("validation_failed", { reason: "exam_class_not_found" });
  await assertCanEditCohort(actorUserId, row.cohortId, db);
  await db.cohortExamClass.delete({ where: { id: examClassId } });
}

async function assertCanEditCohort(
  actorUserId: string,
  cohortId: string,
  db: PrismaClient,
): Promise<{ id: string; courseId: string }> {
  const c = await db.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, courseId: true },
  });
  if (!c) throw new ExamError("cohort_not_found");
  await assertCanEditCourse(actorUserId, c.courseId, db);
  return c;
}

export async function updateCohort(
  actorUserId: string,
  cohortId: string,
  patch: {
    name?: string;
    code?: string | null;
    instructorId?: string | null;
    description?: string | null;
  },
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCohort(actorUserId, cohortId, db);
  const data: {
    name?: string;
    code?: string | null;
    instructorId?: string | null;
    description?: string | null;
  } = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) throw new ExamError("validation_failed");
    data.name = n;
  }
  if (patch.code !== undefined) {
    data.code = patch.code === null ? null : patch.code.trim().toUpperCase();
  }
  if (patch.instructorId !== undefined) data.instructorId = patch.instructorId;
  if (patch.description !== undefined) data.description = patch.description;
  if (Object.keys(data).length === 0) return;
  try {
    await db.cohort.update({ where: { id: cohortId }, data });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("cohort_name_taken");
    throw e;
  }
}

export async function deleteCohort(
  actorUserId: string,
  cohortId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCohort(actorUserId, cohortId, db);
  await db.cohort.delete({ where: { id: cohortId } });
}

// ============================================================================
// Membership
// ============================================================================

/**
 * Add users (by email) to a cohort. Skips users not enrolled in the cohort's
 * course (would be useless — schedules require enrollment too).
 */
export async function addCohortMembers(
  actorUserId: string,
  cohortId: string,
  userEmailsOrIds: string[],
  db: PrismaClient = prisma,
): Promise<{ added: number; skipped: { input: string; reason: string }[] }> {
  const cohort = await assertCanEditCohort(actorUserId, cohortId, db);

  // Resolve emails → user ids. Accept either email or uuid.
  const emails = userEmailsOrIds.filter((s) => s.includes("@"));
  const ids = userEmailsOrIds.filter((s) => !s.includes("@"));
  const users = await db.user.findMany({
    where: { OR: [{ email: { in: emails } }, { id: { in: ids } }] },
    select: { id: true, email: true },
  });
  const byKey = new Map<string, string>();
  for (const u of users) {
    byKey.set(u.email, u.id);
    byKey.set(u.id, u.id);
  }

  let added = 0;
  const skipped: { input: string; reason: string }[] = [];
  for (const input of userEmailsOrIds) {
    const uid = byKey.get(input);
    if (!uid) {
      skipped.push({ input, reason: "user_not_found" });
      continue;
    }
    const enrolled = await isUserEnrolled(uid, cohort.courseId, db);
    if (!enrolled) {
      skipped.push({ input, reason: "not_enrolled" });
      continue;
    }
    try {
      await db.cohortMember.create({
        data: { cohortId, userId: uid },
      });
      added++;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        skipped.push({ input, reason: "already_member" });
      } else {
        skipped.push({ input, reason: "error" });
      }
    }
  }
  return { added, skipped };
}

export async function removeCohortMember(
  actorUserId: string,
  cohortId: string,
  userId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCohort(actorUserId, cohortId, db);
  await db.cohortMember.deleteMany({ where: { cohortId, userId } });
}

export interface CohortMemberItem {
  userId: string;
  displayName: string;
  email: string;
  joinedAt: string;
}

export async function listCohortMembers(
  actorUserId: string,
  cohortId: string,
  db: PrismaClient = prisma,
): Promise<CohortMemberItem[]> {
  await assertCanEditCohort(actorUserId, cohortId, db);
  const rows = await db.cohortMember.findMany({
    where: { cohortId },
    orderBy: { joinedAt: "asc" },
    select: {
      userId: true,
      joinedAt: true,
      user: { select: { displayName: true, email: true } },
    },
  });
  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.user.displayName,
    email: r.user.email,
    joinedAt: r.joinedAt.toISOString(),
  }));
}

// ============================================================================
// ExamSession (legacy: ExamSchedule) CRUD
//
// A5.3 PR1c.5 — Service functions renamed in PR1c.2; deprecated aliases dropped
// here. `createExamSession` now auto-ensures an `ExamRound` for the exam since
// `ExamSession.roundId` is NOT NULL.
// ============================================================================

export const CreateSessionInput = z
  .object({
    cohortId: z.string().uuid().nullable().optional(),
    opensAt: z.coerce.date(),
    closesAt: z.coerce.date(),
    durationOverrideMin: z.number().int().min(1).max(24 * 60).optional().nullable(),
    ipAllowlist: z.array(z.string().min(3).max(43)).max(50).optional(),
  })
  .refine((d) => d.opensAt < d.closesAt, { message: "opensAt must be before closesAt" });

export async function createExamSession(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  const parsed = CreateSessionInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("schedule_invalid_window", parsed.error.flatten());
  const d = parsed.data;

  // If cohortId set, validate it belongs to the same course.
  if (d.cohortId) {
    const cohort = await db.cohort.findUnique({
      where: { id: d.cohortId },
      select: { courseId: true },
    });
    if (!cohort || cohort.courseId !== exam.courseId)
      throw new ExamError("cohort_not_found");
  }

  // A5.3 PR1c.5 — ExamSession.roundId is NOT NULL. Legacy callers don't pass
  // roundId yet (UI still on schedules panel), so ensure the exam has a
  // default round and attach to it. cohortId column kept temporarily for UI
  // backward-compat; dropped when SchedulesPanel is replaced by the new IA.
  const roundId = await ensureDefaultRound(examId, db);
  const s = await db.examSession.create({
    data: {
      examId,
      roundId,
      cohortId: d.cohortId ?? null,
      opensAt: d.opensAt,
      closesAt: d.closesAt,
      durationOverrideMin: d.durationOverrideMin ?? null,
      ipAllowlist: d.ipAllowlist ?? [],
    },
    select: { id: true },
  });
  // Always seed a default room so open_code candidates without a room code
  // get assigned somewhere — otherwise they end up with roomId=NULL and
  // fall out of the session results query.
  await ensureDefaultRoomForSession(actorUserId, s.id, db);
  return s;
}

export interface ExamSessionItem {
  id: string;
  cohortId: string | null;
  cohortName: string | null;
  opensAt: string;
  closesAt: string;
  durationOverrideMin: number | null;
  ipAllowlistCount: number;
}

export async function listExamSessions(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<ExamSessionItem[]> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  const rows = await db.examSession.findMany({
    where: { examId },
    orderBy: { opensAt: "asc" },
    select: {
      id: true,
      cohortId: true,
      opensAt: true,
      closesAt: true,
      durationOverrideMin: true,
      ipAllowlist: true,
      cohort: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    cohortId: r.cohortId,
    cohortName: r.cohort?.name ?? null,
    opensAt: r.opensAt.toISOString(),
    closesAt: r.closesAt.toISOString(),
    durationOverrideMin: r.durationOverrideMin,
    ipAllowlistCount: r.ipAllowlist.length,
  }));
}

export async function deleteExamSession(
  actorUserId: string,
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const s = await db.examSession.findUnique({
    where: { id: sessionId },
    select: { exam: { select: { courseId: true } } },
  });
  if (!s) throw new ExamError("schedule_not_found");
  await assertCanEditCourse(actorUserId, s.exam.courseId, db);
  await db.examSession.delete({ where: { id: sessionId } });
}

// ============================================================================
// Eligibility gate (called from startExamAttempt)
// ============================================================================

export interface ExamEligibility {
  /** Effective duration to freeze on the attempt (in seconds). */
  durationSec: number;
  /** Schedule row that matched (or null if no schedule → exam-window fallback). */
  scheduleId: string | null;
}

/**
 * Decide whether a User can start/resume this exam right now, and what
 * duration applies. Rules:
 *
 *   1. Exam must be `published` (caller already checks but we re-check defensively).
 *   2. If exam has schedules:
 *      - At least one must be "active now" (opensAt <= now < closesAt).
 *      - Among active schedules: cohort-specific (cohortId NOT NULL) where
 *        the user is a member take priority. If none, fall back to
 *        course-wide (cohortId IS NULL) schedules.
 *      - User must still be enrolled in the course.
 *      - Effective duration = schedule.durationOverrideMin (if set) else exam.durationMin.
 *   3. If exam has NO schedules: fall back to exam.openAt/closeAt + enrollment.
 *
 * Throws ExamError with the appropriate code; otherwise returns eligibility.
 */
export async function assertEligibleForExam(
  userId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<ExamEligibility> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      status: true,
      openAt: true,
      closeAt: true,
      durationMin: true,
      schedules: {
        select: {
          id: true,
          cohortId: true,
          opensAt: true,
          closesAt: true,
          durationOverrideMin: true,
        },
      },
    },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.status !== "published") throw new ExamError("exam_not_open");

  const now = new Date();

  // Enrollment is always required for User-mode access.
  const enrolled = await isUserEnrolled(userId, exam.courseId, db);
  if (!enrolled) throw new ExamError("not_enrolled");

  if (exam.schedules.length === 0) {
    // Legacy path — exam window only.
    if (now < exam.openAt) throw new ExamError("exam_not_open");
    if (now >= exam.closeAt) throw new ExamError("exam_window_closed");
    return { durationSec: exam.durationMin * 60, scheduleId: null };
  }

  // Schedule-driven path. Filter to "active right now".
  const active = exam.schedules.filter(
    (s) => now >= s.opensAt && now < s.closesAt,
  );
  if (active.length === 0) {
    // Differentiate "not yet" vs "closed".
    const future = exam.schedules.some((s) => now < s.opensAt);
    throw new ExamError(future ? "exam_not_open" : "exam_window_closed");
  }

  // Cohort membership lookup once.
  const memberships = await db.cohortMember.findMany({
    where: { userId, cohortId: { in: active.map((s) => s.cohortId).filter((id): id is string => id !== null) } },
    select: { cohortId: true },
  });
  const userCohortIds = new Set(memberships.map((m) => m.cohortId));

  // Prefer cohort-specific schedule matches; else allow course-wide (null).
  const cohortMatch = active.find((s) => s.cohortId && userCohortIds.has(s.cohortId));
  const wide = active.find((s) => s.cohortId === null);
  const picked = cohortMatch ?? wide;

  if (!picked) {
    // All active schedules are cohort-specific and user is in none.
    throw new ExamError("cohort_required");
  }

  const durationMin = picked.durationOverrideMin ?? exam.durationMin;
  return { durationSec: durationMin * 60, scheduleId: picked.id };
}
