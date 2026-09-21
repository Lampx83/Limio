/**
 * A5.3.5 — Instructor live actions on an in-progress exam attempt.
 *
 * Every action:
 *   1. Loads the attempt + exam.courseId
 *   2. Asserts the actor can edit the course
 *   3. Mutates ExamAttempt state
 *   4. Emits an audit LearningEvent in the same transaction
 *
 * Never mutates Module B (Feedback) or C (Gamification) state directly — those
 * subscribe via LearningEvent (§5.2 CLAUDE.md).
 */

import { randomUUID } from "node:crypto";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanModerateLiveExamForExam } from "../courses/authz";
import { emitEvent } from "../learning/events";
import {
  finalizeSubmission,
  markAttemptSubmitted,
  type ExamSubmitResult,
  type MarkAttemptResult,
} from "./submission";
import { ExamError } from "./types";

const MAX_EXTENSION_MIN = 30;

async function loadAttemptForAction(
  attemptId: string,
  db: PrismaClient,
): Promise<{
  id: string;
  examId: string;
  userId: string | null;
  status: string;
  courseId: string | null;
  createdById: string | null;
  durationSec: number;
  startedAt: Date;
}> {
  const a = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      examId: true,
      userId: true,
      status: true,
      durationSec: true,
      startedAt: true,
      exam: { select: { courseId: true, createdById: true, kind: true } },
    },
  });
  if (!a) throw new ExamError("attempt_not_found");
  // A6.5 — Vấn đáp AI có luồng nộp/kết thúc riêng qua runOralExamTurn (hết
  // giờ/đủ câu) + submitOralEvaluation (GV duyệt điểm) — KHÔNG đi qua đây.
  // Các hành động này (đặc biệt force-submit) sẽ kích enqueueAutoGrade, mà
  // applyAutoGrading trên 0 ExamQuestion trả vacuously "allGraded: true,
  // score: 0" — âm thầm chấm 0 điểm một buổi vấn đáp đang diễn ra thật. Chặn
  // ở đây để mọi hành động (extend/force-submit/disqualify/reset-session)
  // đều được bảo vệ cùng lúc, không phải sửa từng cái.
  if (a.exam.kind === "oral") {
    throw new ExamError("exam_not_written", {
      reason: "oral_uses_own_lifecycle",
      message:
        "Đề vấn đáp AI không dùng hành động này — buổi vấn đáp tự kết thúc khi hết giờ/đủ câu hỏi, và điểm chốt ở tab Chấm bài.",
    });
  }
  return {
    id: a.id,
    examId: a.examId,
    userId: a.userId,
    status: a.status,
    durationSec: a.durationSec,
    startedAt: a.startedAt,
    courseId: a.exam.courseId,
    createdById: a.exam.createdById,
  };
}

function requireReason(reason: unknown): string {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new ExamError("reason_required");
  }
  return reason.trim().slice(0, 500);
}

/** Extend an in-progress attempt's duration. Max +MAX_EXTENSION_MIN. */
export async function extendAttempt(
  actorUserId: string,
  attemptId: string,
  minutes: number,
  db: PrismaClient = prisma,
): Promise<{ newDurationSec: number; newDeadline: Date }> {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_EXTENSION_MIN) {
    throw new ExamError("duration_extension_too_large", { max: MAX_EXTENSION_MIN });
  }
  const a = await loadAttemptForAction(attemptId, db);
  await assertCanModerateLiveExamForExam(actorUserId, a, db);
  if (a.status !== "in_progress") throw new ExamError("attempt_not_in_progress");

  const newDurationSec = a.durationSec + minutes * 60;
  await db.examAttempt.update({
    where: { id: attemptId },
    data: { durationSec: newDurationSec },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamAttemptExtended,
    {
      examId: a.examId,
      attemptId,
      learnerUserId: a.userId,
      addedMinutes: minutes,
      newDurationSec,
    },
    {
      courseId: a.courseId,
      eventKey: `exam.attempt.extended:${attemptId}:${Date.now()}`,
    },
    db,
  );
  const newDeadline = new Date(a.startedAt.getTime() + newDurationSec * 1000);
  return { newDurationSec, newDeadline };
}

/** Force-submit an in-progress attempt on the learner's behalf. */
export async function forceSubmitAttempt(
  actorUserId: string,
  attemptId: string,
  rawReason: unknown,
  db: PrismaClient = prisma,
): Promise<ExamSubmitResult> {
  const reason = requireReason(rawReason);
  const a = await loadAttemptForAction(attemptId, db);
  await assertCanModerateLiveExamForExam(actorUserId, a, db);
  if (a.status !== "in_progress") throw new ExamError("attempt_not_in_progress");

  const result = await finalizeSubmission(attemptId, "force_submitted", db);
  await emitEvent(
    actorUserId,
    LearningEventType.ExamAttemptForceSubmitted,
    {
      examId: a.examId,
      attemptId,
      learnerUserId: a.userId,
      reason,
    },
    {
      courseId: a.courseId,
      eventKey: `exam.attempt.force_submitted:${attemptId}`,
    },
    db,
  );
  return result;
}

/**
 * Tintin — Mark-only variant of force-submit. Marks the attempt as submitted
 * (status="submitted") and emits ExamSubmitted + ExamAttemptForceSubmitted
 * events, but defers auto-grading to a BullMQ job enqueued by the API route.
 */
export async function forceSubmitAttemptMarkOnly(
  actorUserId: string,
  attemptId: string,
  rawReason: unknown,
  db: PrismaClient = prisma,
): Promise<MarkAttemptResult> {
  const reason = requireReason(rawReason);
  const a = await loadAttemptForAction(attemptId, db);
  await assertCanModerateLiveExamForExam(actorUserId, a, db);
  if (a.status !== "in_progress") throw new ExamError("attempt_not_in_progress");

  const result = await markAttemptSubmitted(attemptId, "force_submitted", db);
  await emitEvent(
    actorUserId,
    LearningEventType.ExamAttemptForceSubmitted,
    {
      examId: a.examId,
      attemptId,
      learnerUserId: a.userId,
      reason,
    },
    {
      courseId: a.courseId,
      eventKey: `exam.attempt.force_submitted:${attemptId}`,
    },
    db,
  );
  return result;
}

/**
 * Rotate the single-tab session lock. Useful when a learner is stuck in
 * "session_stale" loop (left tab open on dead device).
 */
export async function resetAttemptSession(
  actorUserId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ sessionToken: string; resumeCount: number }> {
  const a = await loadAttemptForAction(attemptId, db);
  await assertCanModerateLiveExamForExam(actorUserId, a, db);
  if (a.status !== "in_progress") throw new ExamError("attempt_not_in_progress");

  const newToken = randomUUID();
  const updated = await db.examAttempt.update({
    where: { id: attemptId },
    data: { sessionToken: newToken, resumeCount: { increment: 1 } },
    select: { sessionToken: true, resumeCount: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamAttemptSessionReset,
    {
      examId: a.examId,
      attemptId,
      learnerUserId: a.userId,
      resumeCount: updated.resumeCount,
    },
    {
      courseId: a.courseId,
      eventKey: `exam.attempt.session_reset:${attemptId}:${updated.resumeCount}`,
    },
    db,
  );
  return updated;
}

/** Thời hạn của quyền vào lại do giảng viên cấp (phút). */
export const REENTRY_GRANT_MINUTES = 15;

/**
 * Cho một thí sinh vào lại bài đang làm dở dù không qua được bước xác thực.
 *
 * Thí sinh vào bằng mã thi mở chỉ vào lại được khi nhập đúng email/SĐT (hoặc họ
 * tên) đã dùng lúc đầu — xem isSameOwner trong code-access.ts. Người quên/gõ sai
 * thì kẹt: "Reset session" không giúp được vì nó chỉ xoay khoá phiên cho máy còn
 * cookie. Thao tác này là đường thoát: giảng viên/giám thị (đã tự nhận diện người
 * đó tại chỗ) mở một quyền vào lại DÙNG MỘT LẦN, hết hạn sau
 * REENTRY_GRANT_MINUTES phút. Lượt vào lại tiếp theo chỉ cần nhập MSSV; thông tin
 * email/SĐT họ nhập lúc đó trở thành yếu tố xác thực mới.
 *
 * Lưu trong ExamCandidate.metadata (không cần migration). Chỉ dùng cho thí sinh
 * vào bằng mã; học viên đăng nhập không có bước này.
 */
export async function grantAttemptReentry(
  actorUserId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ expiresAt: Date }> {
  const a = await loadAttemptForAction(attemptId, db);
  await assertCanModerateLiveExamForExam(actorUserId, a, db);
  const g = await openReentryGrant(attemptId, db);
  await emitEvent(
    actorUserId,
    LearningEventType.ExamAttemptSessionReset,
    {
      examId: a.examId,
      attemptId,
      candidateId: g.candidateId,
      action: "reentry_granted",
      expiresAt: g.expiresAt.toISOString(),
    },
    {
      courseId: a.courseId,
      candidateId: g.candidateId,
      eventKey: `exam.attempt.reentry_granted:${attemptId}:${Date.now()}`,
    },
    db,
  );
  return { expiresAt: g.expiresAt };
}

/**
 * Phần ghi quyền vào lại, dùng chung cho giảng viên (có tài khoản) và giám thị
 * (vào bằng mã phòng). KHÔNG kiểm quyền — người gọi phải làm việc đó trước.
 */
export async function openReentryGrant(
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ expiresAt: Date; candidateId: string }> {
  const att = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { status: true, candidateId: true, candidate: { select: { metadata: true } } },
  });
  if (!att) throw new ExamError("attempt_not_found");
  if (att.status !== "in_progress") throw new ExamError("attempt_not_in_progress");
  if (!att.candidateId || !att.candidate)
    throw new ExamError("validation_failed", {
      message: "Chỉ dùng cho thí sinh vào bằng mã thi (học viên đăng nhập không cần bước này).",
    });

  const expiresAt = new Date(Date.now() + REENTRY_GRANT_MINUTES * 60_000);
  const meta =
    att.candidate.metadata && typeof att.candidate.metadata === "object"
      ? (att.candidate.metadata as Record<string, unknown>)
      : {};
  await db.examCandidate.update({
    where: { id: att.candidateId },
    data: { metadata: { ...meta, reentryGrantedUntil: expiresAt.toISOString() } as never },
  });
  return { expiresAt, candidateId: att.candidateId };
}

/**
 * Flag an attempt (status=flagged). Does NOT auto-zero the score — instructor
 * decides during grading whether to award partial credit (§spec).
 */
export async function disqualifyAttempt(
  actorUserId: string,
  attemptId: string,
  rawReason: unknown,
  db: PrismaClient = prisma,
): Promise<{ status: "flagged" }> {
  const reason = requireReason(rawReason);
  const a = await loadAttemptForAction(attemptId, db);
  await assertCanModerateLiveExamForExam(actorUserId, a, db);
  if (a.status === "flagged") return { status: "flagged" };

  await db.examAttempt.update({
    where: { id: attemptId },
    data: { status: "flagged" },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamAttemptDisqualified,
    {
      examId: a.examId,
      attemptId,
      learnerUserId: a.userId,
      reason,
      priorStatus: a.status,
    },
    {
      courseId: a.courseId,
      eventKey: `exam.attempt.disqualified:${attemptId}`,
    },
    db,
  );
  return { status: "flagged" };
}
