import { randomUUID } from "node:crypto";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { assertEligibleForExam } from "./cohorts";
import { ExamError } from "./types";

/**
 * A6.3 — Bắt đầu (hoặc resume) 1 lượt vấn đáp AI. Dùng lại nguyên
 * `assertEligibleForExam` (status/ca thi/cohort/enrollment — không quan tâm
 * loại câu hỏi) và bảng `ExamAttempt` sẵn có, nhưng KHÔNG gọi
 * buildShuffleSnapshot/materializeRandomSections như startExamAttempt: vấn
 * đáp không có ExamQuestion để xáo hay lấy pool.
 *
 * Phạm vi bản này: chỉ sinh viên đã đăng nhập + đã ghi danh (đường vào
 * ExamCandidate/mã code của thi viết chưa nối — để dành đợt sau cùng
 * dashboard giám thị).
 */
export async function startOralExamAttempt(
  userId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<{ attemptId: string; durationSec: number; resumed: boolean }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.kind !== "oral") throw new ExamError("exam_not_oral");

  const eligibility = await assertEligibleForExam(userId, examId, db);

  const existing = await db.examAttempt.findFirst({
    where: { examId, userId },
    select: { id: true, status: true, durationSec: true },
  });
  if (existing) {
    if (existing.status === "in_progress") {
      return { attemptId: existing.id, durationSec: existing.durationSec, resumed: true };
    }
    throw new ExamError("attempt_already_submitted");
  }

  const attemptId = randomUUID();
  const durationSec = eligibility.durationSec;
  await db.examAttempt.create({
    data: {
      id: attemptId,
      examId,
      userId,
      durationSec,
      sessionToken: randomUUID(),
      sessionId: eligibility.scheduleId,
    },
  });
  await emitEvent(
    userId,
    LearningEventType.ExamStarted,
    { examId, attemptId, durationSec },
    { courseId: exam.courseId, eventKey: `exam.started:${attemptId}` },
    db,
  );
  return { attemptId, durationSec, resumed: false };
}
