/**
 * P0 Phòng thi — group exam candidates into rooms, each with one proctor
 * (giám thị) overseeing the live session and 0..N graders who chấm essays
 * of the room's candidates. Proctor + grader roles are disjoint per spec.
 *
 * Use case: 1 ca thi có nhiều phòng (~50 thí sinh/phòng), mỗi phòng 1 giám
 * thị, sau khi xong export điểm theo phòng. P0 covers CRUD + assignment +
 * per-room candidate listing. Role-scoped permissions (proctor-only views,
 * grader-only essays) are P1.
 */

import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditExam } from "../courses/authz";
import { ExamError } from "./types";
import { LearningEventType } from "@feedbackme/shared-types";
import { changedFields, courseIdOf, emitOrganizeEvent } from "./organize-events";

// ============================================================================
// Room access code (cho thí sinh tự nhập khi join exam open_code)
// ============================================================================

// Cùng alphabet với openCode — bỏ 0/O/1/I/l để tránh nhầm.
const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
  return s;
}

/**
 * Sinh mã phòng unique trong 1 sessionId. Retry tối đa 8 lần.
 * 31^4 ≈ 920k combo nên collision cực hiếm; nếu vẫn cạn thì throw.
 */
export async function generateUniqueRoomCode(
  sessionId: string,
  db: PrismaClient,
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateRoomCode();
    const clash = await db.examRoom.findFirst({
      where: { sessionId, accessCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  throw new ExamError(
    "validation_failed",
    "room_code_generation_failed",
  );
}

// ============================================================================
// Schemas
// ============================================================================

export const RoomNameSchema = z.string().min(1).max(120).trim();

export const CreateExamRoomInput = z.object({
  name: RoomNameSchema,
  proctorUserId: z.string().uuid(),
  locationNote: z.string().max(500).optional().nullable(),
  graderUserIds: z.array(z.string().uuid()).default([]),
});

export const UpdateExamRoomInput = z.object({
  name: RoomNameSchema.optional(),
  proctorUserId: z.string().uuid().optional(),
  // PR2.18 — Email alternative: server tự find/invite GV → set proctorUserId.
  proctorEmail: z.string().email().optional(),
  locationNote: z.string().max(500).optional().nullable(),
  // PR2.19 — Đổi ca thi của phòng (move sang session khác trong cùng round).
  sessionId: z.string().uuid().optional(),
  // PR2.19 — STT theo Excel.
  sourceRowNum: z.number().int().min(0).max(99999).optional().nullable(),
  // Full replacement of grader set when provided.
  graderUserIds: z.array(z.string().uuid()).optional(),
});

export const AssignCandidatesInput = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(500),
  // null = unassign (clear roomId).
  roomId: z.string().uuid().nullable(),
});

// ============================================================================
// Types
// ============================================================================

export interface ExamRoomListItem {
  id: string;
  name: string;
  proctorUserId: string;
  proctorName: string;
  locationNote: string | null;
  graders: Array<{ id: string; displayName: string }>;
  candidateCount: number;
  // attempts.status grouped: pending=candidates with no attempt yet,
  // inProgress + submitted from attempts.
  pendingCount: number;
  inProgressCount: number;
  submittedCount: number;
  createdAt: string;
}

// ============================================================================
// CRUD
// ============================================================================

export async function listExamRooms(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<ExamRoomListItem[]> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);

  const rooms = await db.examRoom.findMany({
    where: { examId },
    orderBy: [{ name: "asc" }],
    include: {
      proctor: { select: { id: true, displayName: true } },
      graders: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      _count: { select: { candidates: true } },
    },
  });

  // Attempt-status breakdown per room (one query, group on roomId via
  // candidate join). Avoids N+1.
  const attemptStats = await db.examAttempt.groupBy({
    by: ["status", "candidateId"],
    where: {
      examId,
      candidateId: { not: null },
    },
    _count: { _all: true },
  });
  // Map candidateId → latest status by simple precedence (submitted > in_progress).
  const candidateStatus = new Map<string, "submitted" | "in_progress">();
  for (const row of attemptStats) {
    if (!row.candidateId) continue;
    const prev = candidateStatus.get(row.candidateId);
    if (row.status === "submitted") {
      candidateStatus.set(row.candidateId, "submitted");
    } else if (row.status === "in_progress" && prev !== "submitted") {
      candidateStatus.set(row.candidateId, "in_progress");
    }
  }

  // Pull candidate→room mapping in bulk.
  const candidates = await db.examCandidate.findMany({
    where: { examId, roomId: { not: null } },
    select: { id: true, roomId: true },
  });
  const roomCounts = new Map<
    string,
    { pending: number; inProgress: number; submitted: number }
  >();
  for (const c of candidates) {
    if (!c.roomId) continue;
    let bucket = roomCounts.get(c.roomId);
    if (!bucket) {
      bucket = { pending: 0, inProgress: 0, submitted: 0 };
      roomCounts.set(c.roomId, bucket);
    }
    const st = candidateStatus.get(c.id);
    if (st === "submitted") bucket.submitted++;
    else if (st === "in_progress") bucket.inProgress++;
    else bucket.pending++;
  }

  return rooms.map((r) => {
    const counts = roomCounts.get(r.id) ?? {
      pending: 0,
      inProgress: 0,
      submitted: 0,
    };
    return {
      id: r.id,
      name: r.name,
      proctorUserId: r.proctorUserId,
      proctorName: r.proctor.displayName,
      locationNote: r.locationNote,
      graders: r.graders.map((g) => ({
        id: g.user.id,
        displayName: g.user.displayName,
      })),
      candidateCount: r._count.candidates,
      pendingCount: counts.pending,
      inProgressCount: counts.inProgress,
      submittedCount: counts.submitted,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

async function createExamRoomImpl(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);

  const parsed = CreateExamRoomInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());

  await assertUserExists(db, parsed.data.proctorUserId);
  for (const g of parsed.data.graderUserIds) await assertUserExists(db, g);

  // A5.3 PR1c.3 — Room phải gắn vào 1 ExamSession (ca thi). UI hiện tại vẫn
  // tạo room qua exam scope (legacy), nên service tự ensure 1 session mặc
  // định cho exam và auto-assign orderIndex. Khi UI chuyển sang session-scoped
  // routes (PR2+), tham số sẽ đổi thành sessionId trực tiếp.
  const sessionId = await ensureDefaultSession(examId, db);
  const orderIndex = await nextRoomOrderIndex(sessionId, db);
  const accessCode = await generateUniqueRoomCode(sessionId, db);
  // Phòng đầu tiên trong session tự động làm default — thí sinh không nhập
  // mã phòng sẽ rơi vào đây.
  const existingDefault = await db.examRoom.findFirst({
    where: { sessionId, isDefault: true },
    select: { id: true },
  });
  const isDefault = !existingDefault;

  try {
    const room = await db.examRoom.create({
      data: {
        examId,
        sessionId,
        orderIndex,
        name: parsed.data.name,
        proctorUserId: parsed.data.proctorUserId,
        locationNote: parsed.data.locationNote ?? null,
        accessCode,
        isDefault,
        graders: {
          create: parsed.data.graderUserIds.map((userId) => ({ userId })),
        },
      },
      select: { id: true },
    });
    return room;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new ExamError("validation_failed", {
        field: "name",
        reason: "duplicate",
      });
    }
    throw e;
  }
}

async function updateExamRoomImpl(
  actorUserId: string,
  roomId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const room = await db.examRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      examId: true,
      exam: {
        select: {
          courseId: true,
          createdById: true,
          course: { select: { organizationId: true } },
        },
      },
    },
  });
  if (!room) throw new ExamError("validation_failed", { reason: "room_not_found" });
  await assertCanEditExam(actorUserId, room.exam, db);
  const organizationId = room.exam.course?.organizationId ?? null;

  const parsed = UpdateExamRoomInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());

  // PR2.18 — Resolve proctorEmail → existing user, or invite if not found.
  let resolvedProctorId = parsed.data.proctorUserId;
  if (!resolvedProctorId && parsed.data.proctorEmail) {
    const { findOrInviteUserByEmail } = await import("../auth/invite");
    const inv = await findOrInviteUserByEmail({
      email: parsed.data.proctorEmail,
      displayName: parsed.data.proctorEmail.split("@")[0]!,
      baseUrl: "",
      templateKey: "exam.proctor_invite",
      organizationId,
      db,
    });
    resolvedProctorId = inv.userId;
  }

  if (resolvedProctorId)
    await assertUserExists(db, resolvedProctorId);
  if (parsed.data.graderUserIds)
    for (const g of parsed.data.graderUserIds) await assertUserExists(db, g);

  // PR2.19 — Khi đổi sessionId, validate session thuộc cùng round với phòng
  // hiện tại (không cho move chéo round).
  if (parsed.data.sessionId) {
    const newSession = await db.examSession.findUnique({
      where: { id: parsed.data.sessionId },
      select: { roundId: true },
    });
    const currentSession = await db.examSession.findUnique({
      where: { id: (await db.examRoom.findUniqueOrThrow({
        where: { id: roomId },
        select: { sessionId: true },
      })).sessionId },
      select: { roundId: true },
    });
    if (!newSession || !currentSession || newSession.roundId !== currentSession.roundId) {
      throw new ExamError("validation_failed", {
        reason: "session_round_mismatch",
      });
    }
  }

  await db.$transaction(async (tx) => {
    const data: {
      name?: string;
      proctorUserId?: string;
      locationNote?: string | null;
      sessionId?: string;
      sourceRowNum?: number | null;
    } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (resolvedProctorId !== undefined)
      data.proctorUserId = resolvedProctorId;
    if (parsed.data.locationNote !== undefined)
      data.locationNote = parsed.data.locationNote;
    if (parsed.data.sessionId !== undefined)
      data.sessionId = parsed.data.sessionId;
    if (parsed.data.sourceRowNum !== undefined)
      data.sourceRowNum = parsed.data.sourceRowNum;
    if (Object.keys(data).length > 0) {
      try {
        await tx.examRoom.update({ where: { id: roomId }, data });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") {
          throw new ExamError("validation_failed", {
            field: "name",
            reason: "duplicate",
          });
        }
        throw e;
      }
    }
    // Replace grader set wholesale when caller provides it.
    if (parsed.data.graderUserIds !== undefined) {
      await tx.examRoomGrader.deleteMany({ where: { roomId } });
      if (parsed.data.graderUserIds.length > 0) {
        await tx.examRoomGrader.createMany({
          data: parsed.data.graderUserIds.map((userId) => ({ roomId, userId })),
        });
      }
    }
  });
}

async function deleteExamRoomImpl(
  actorUserId: string,
  roomId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const room = await db.examRoom.findUnique({
    where: { id: roomId },
    select: { exam: { select: { courseId: true, createdById: true } } },
  });
  if (!room) return; // idempotent
  await assertCanEditExam(actorUserId, room.exam, db);
  // FK on candidate.roomId is SET NULL — candidates survive, just unassigned.
  await db.examRoom.delete({ where: { id: roomId } });
}

/**
 * Đặt 1 phòng làm phòng mặc định của ca thi nó thuộc. Atomically clear cờ
 * isDefault ở các phòng anh em trong cùng session trước, rồi set cho phòng
 * này — partial unique index sẽ chặn race. Idempotent: gọi lại trên phòng
 * đã default trả nguyên trạng.
 */
export async function setRoomAsDefault(
  actorUserId: string,
  roomId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const room = await db.examRoom.findUnique({
    where: { id: roomId },
    select: {
      sessionId: true,
      isDefault: true,
      exam: { select: { courseId: true, createdById: true } },
    },
  });
  if (!room) throw new ExamError("validation_failed", { reason: "room_not_found" });
  await assertCanEditExam(actorUserId, room.exam, db);
  if (room.isDefault) return;
  await (db as typeof prisma).$transaction([
    db.examRoom.updateMany({
      where: { sessionId: room.sessionId, isDefault: true },
      data: { isDefault: false },
    }),
    db.examRoom.update({
      where: { id: roomId },
      data: { isDefault: true },
    }),
  ]);
}

// ============================================================================
// Candidate assignment
// ============================================================================

export async function assignCandidatesToRoom(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ assigned: number }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);

  const parsed = AssignCandidatesInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());

  // Guard: room must belong to same exam (if provided).
  if (parsed.data.roomId) {
    const room = await db.examRoom.findUnique({
      where: { id: parsed.data.roomId },
      select: { examId: true },
    });
    if (!room || room.examId !== examId)
      throw new ExamError("validation_failed", { reason: "room_exam_mismatch" });
  }

  // Bulk update — restrict to candidates of this exam to avoid cross-exam
  // foot-guns when caller mistakenly passes ids from another exam.
  const result = await db.examCandidate.updateMany({
    where: { examId, id: { in: parsed.data.candidateIds } },
    data: { roomId: parsed.data.roomId },
  });
  return { assigned: result.count };
}

// ============================================================================
// Helpers
// ============================================================================

async function assertUserExists(db: PrismaClient, userId: string): Promise<void> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!u)
    throw new ExamError("validation_failed", { reason: "user_not_found" });
}

// A5.3 PR1c.5 — Returns the default ExamRound for an exam, creating one (with
// ExamRoundCourse bridge) if no round is yet linked to any of the exam's
// sessions. Idempotent. Used by `createExamSession()` to satisfy NOT NULL
// roundId on new sessions created via legacy exam-scoped paths.
export async function ensureDefaultRound(
  examId: string,
  db: PrismaClient = prisma,
): Promise<string> {
  // After PR1c.5, every session has a roundId (NOT NULL), so any existing
  // session of this exam can give us a round to reuse.
  const linked = await db.examSession.findFirst({
    where: { examId },
    select: { roundId: true },
  });
  if (linked) return linked.roundId;

  const exam = await db.exam.findUniqueOrThrow({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      title: true,
      openAt: true,
      closeAt: true,
      status: true,
    },
  });

  const round = await db.examRound.create({
    data: {
      code: `AUTO-EXAM-${exam.id.slice(0, 8)}-${Date.now().toString(36)}`,
      title: `Đợt thi tự động — ${exam.title}`,
      opensAt: exam.openAt,
      closesAt: exam.closeAt,
      status: exam.status === "archived" ? "archived" : "draft",
      courseId: exam.courseId,
    },
    select: { id: true },
  });
  return round.id;
}

// A5.3 PR1c.3 — Returns the default ExamSession for an exam, creating one
// (with its ExamRound + ExamRoundCourse) if none exists. Idempotent: mirrors
// the PR1b migration backfill so legacy exam-scoped flows can keep working
// while the data model is session-scoped. Prefers the earliest session by
// opensAt + createdAt to be deterministic.
export async function ensureDefaultSession(
  examId: string,
  db: PrismaClient = prisma,
): Promise<string> {
  // After PR1c.5 every session has a roundId, so reusing the earliest session
  // is sufficient — no need to fix up a null roundId mid-flight.
  const existing = await db.examSession.findFirst({
    where: { examId },
    orderBy: [{ opensAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (existing) return existing.id;

  const roundId = await ensureDefaultRound(examId, db);
  const exam = await db.exam.findUniqueOrThrow({
    where: { id: examId },
    select: { openAt: true, closeAt: true },
  });
  const created = await db.examSession.create({
    data: {
      examId,
      roundId,
      code: "CA-DEFAULT",
      title: "Ca mặc định",
      opensAt: exam.openAt,
      closesAt: exam.closeAt,
    },
    select: { id: true },
  });
  return created.id;
}

// A5.3 PR1c.3 — Next available orderIndex for a session (1-based, monotone
// per session). Concurrent inserts could in theory race; the @@unique on
// (sessionId, orderIndex) added in PR1c.5 will surface a P2002 that the
// caller can retry. For PR1c.3 we just compute max+1.
async function nextRoomOrderIndex(
  sessionId: string,
  db: PrismaClient,
): Promise<number> {
  const top = await db.examRoom.findFirst({
    where: { sessionId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  return (top?.orderIndex ?? 0) + 1;
}

/**
 * Idempotently ensure the session has at least one room, marked as default.
 * Called right after `createExamSession*` so an open_code (free) session
 * always has a fallback room for candidates who don't enter a room code —
 * without this, the candidate's ExamCandidate row gets roomId=NULL and the
 * session results query (filters by roomId or by sessionId-with-room-join)
 * loses them.
 *
 * No-op if any room already exists in the session. Uses the session's exam
 * to find the right examId and assigns the actor as initial proctor (same
 * pattern as `bulkCreateExamRooms`). Instructor can rename / reassign later.
 *
 * Authorization NOT re-checked — caller is the one creating the session and
 * has already passed assertCanEditCourse / assertCanEdit(round).
 *
 * Tên phòng phải ĐỘC NHẤT TRONG GÓI ĐỀ, không chỉ trong ca: ExamRoom có
 * `@@unique([examId, name])`. Bản trước luôn đặt "Phòng mặc định", nên ca THỨ
 * HAI của cùng một gói đề không tạo nổi phòng — P2002. Lỗi nằm im vì luồng mở
 * nhanh cũ luôn dùng lại ca cũ thay vì tạo ca mới; nó lộ ra ngay khi cùng một
 * gói đề mở được nhiều buổi, và nó cũng làm hỏng "Tạo nhiều ca thi" từ 2 ca
 * trở lên.
 */
export async function ensureDefaultRoomForSession(
  actorUserId: string,
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<{ created: boolean; roomId: string }> {
  // Fast-path: any room exists → nothing to do.
  const existing = await db.examRoom.findFirst({
    where: { sessionId },
    select: { id: true },
    orderBy: { orderIndex: "asc" },
  });
  if (existing) return { created: false, roomId: existing.id };

  const session = await db.examSession.findUnique({
    where: { id: sessionId },
    select: { examId: true },
  });
  if (!session) throw new ExamError("schedule_not_found");

  const accessCode = await generateUniqueRoomCode(sessionId, db);

  // Tìm tên còn trống trong gói đề. Thử theo thứ tự chứ không đếm số phòng
  // hiện có: phòng bị xoá sẽ để lại lỗ, đếm thì đâm vào tên đã dùng.
  for (let n = 1; n <= 200; n++) {
    const name = n === 1 ? "Phòng mặc định" : `Phòng mặc định ${n}`;
    try {
      const room = await db.examRoom.create({
        data: {
          examId: session.examId,
          sessionId,
          orderIndex: 1,
          name,
          proctorUserId: actorUserId,
          locationNote: null,
          accessCode,
          isDefault: true,
        },
        select: { id: true },
      });
      return { created: true, roomId: room.id };
    } catch (e) {
      // Chỉ nuốt đúng va chạm tên. Va chạm accessCode hay lỗi khác phải nổ —
      // thử lại 200 lần với cùng một accessCode thì không đời nào qua được.
      const err = e as { code?: string; meta?: { target?: unknown } };
      const target = Array.isArray(err.meta?.target)
        ? (err.meta!.target as string[])
        : [];
      if (err.code !== "P2002" || !target.includes("name")) throw e;
    }
  }
  throw new ExamError("validation_failed", {
    reason: "room_name_exhausted",
    message: "Gói đề đã có quá nhiều phòng mặc định.",
  });
}

// A5.3 PR2.6 — Bulk-create N rooms in a session with placeholder names
// "Phòng 1", "Phòng 2"... so the instructor can quickly scaffold a session
// and fill in proctor / location per row afterwards. The actor is set as the
// initial proctor (required field) — instructor changes to the real proctor
// later via inline edit.
export const BulkCreateExamRoomsInput = z.object({
  count: z.number().int().min(1).max(50),
  namePrefix: z.string().min(1).max(40).optional(),
});

export async function bulkCreateExamRooms(
  actorUserId: string,
  sessionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ created: number; roomIds: string[] }> {
  const session = await db.examSession.findUnique({
    where: { id: sessionId },
    select: { examId: true, exam: { select: { courseId: true, createdById: true } } },
  });
  if (!session) throw new ExamError("schedule_not_found");
  await assertCanEditExam(actorUserId, session.exam, db);

  const parsed = BulkCreateExamRoomsInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const { count, namePrefix } = parsed.data;
  const prefix = namePrefix?.trim() || "Phòng";

  // Find current max orderIndex so new rows append.
  const top = await db.examRoom.findFirst({
    where: { sessionId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true, name: true },
  });
  const startIdx = (top?.orderIndex ?? 0) + 1;

  // Pre-check name collisions: existing room names with same prefix.
  const existing = await db.examRoom.findMany({
    where: { sessionId, name: { startsWith: prefix } },
    select: { name: true },
  });
  const taken = new Set(existing.map((r) => r.name));

  // Check once: session đã có default chưa? Nếu chưa, phòng đầu tiên trong
  // bulk này sẽ làm default.
  const hasDefault = await db.examRoom.findFirst({
    where: { sessionId, isDefault: true },
    select: { id: true },
  });
  let needsDefault = !hasDefault;

  // Generate names skipping taken ones, e.g. if "Phòng 1" exists go straight
  // to "Phòng 2". This makes re-runs idempotent-feeling.
  const created: string[] = [];
  let nextNum = 1;
  for (let i = 0; i < count; i++) {
    while (taken.has(`${prefix} ${nextNum}`)) nextNum++;
    const accessCode = await generateUniqueRoomCode(sessionId, db);
    const room = await db.examRoom.create({
      data: {
        examId: session.examId,
        sessionId,
        orderIndex: startIdx + i,
        name: `${prefix} ${nextNum}`,
        proctorUserId: actorUserId,
        locationNote: null,
        accessCode,
        isDefault: needsDefault,
      },
      select: { id: true },
    });
    if (needsDefault) needsDefault = false;
    created.push(room.id);
    taken.add(`${prefix} ${nextNum}`);
    nextNum++;
  }
  return { created: created.length, roomIds: created };
}

// ============================================================================
// Audit — mỗi hàm dưới đây bọc hàm gốc (`...Impl`) và phát LearningEvent SAU khi hàm
// gốc thành công (xem organize-events.ts). Bọc thay vì chèn vào thân hàm vì các hàm
// gốc có nhiều điểm trả về; hàm nào ném lỗi thì không phát gì.
// ============================================================================

export async function createExamRoom(
  ...args: Parameters<typeof createExamRoomImpl>
): ReturnType<typeof createExamRoomImpl> {
  const [actorUserId, examId] = args;
  const db = args[3] ?? prisma;
  const room = await createExamRoomImpl(...args);
  await emitOrganizeEvent(
    actorUserId,
    LearningEventType.ExamRoomCreated,
    { roomId: room.id, examId },
    await courseIdOf({ examId }, db),
    db,
  );
  return room;
}

export async function updateExamRoom(
  ...args: Parameters<typeof updateExamRoomImpl>
): ReturnType<typeof updateExamRoomImpl> {
  const [actorUserId, roomId, rawInput] = args;
  const db = args[3] ?? prisma;
  await updateExamRoomImpl(...args);
  const fields = changedFields(rawInput);
  if (fields.length === 0) return;
  await emitOrganizeEvent(
    actorUserId,
    LearningEventType.ExamRoomUpdated,
    { roomId, fields },
    await courseIdOf({ roomId }, db),
    db,
  );
}

export async function deleteExamRoom(
  ...args: Parameters<typeof deleteExamRoomImpl>
): ReturnType<typeof deleteExamRoomImpl> {
  const [actorUserId, roomId] = args;
  const db = args[2] ?? prisma;
  // Hàm gốc idempotent (phòng không có thì im lặng). Chỉ ghi sự kiện khi phòng
  // thật sự tồn tại, và lấy khoá học trước khi xoá.
  const existed = await db.examRoom.findUnique({
    where: { id: roomId },
    select: { exam: { select: { courseId: true } } },
  });
  await deleteExamRoomImpl(...args);
  if (existed)
    await emitOrganizeEvent(
      actorUserId,
      LearningEventType.ExamRoomDeleted,
      { roomId },
      existed.exam.courseId,
      db,
    );
}
