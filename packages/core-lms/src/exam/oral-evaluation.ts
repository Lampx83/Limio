import { z } from "zod";
import { prisma, type OralExamEvaluation, type OralExamTurn, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { ExamError } from "./types";

// A6.4 — GV xem/duyệt điểm AI đề xuất cho 1 buổi vấn đáp đã kết thúc. AI chỉ
// ĐỀ XUẤT (xem generateOralExamEvaluation ở core-feedback) — điểm chỉ có
// hiệu lực sau khi GV gọi submitOralEvaluation dưới đây.

async function loadOralAttemptForGrading(attemptId: string, db: PrismaClient) {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      exam: { select: { id: true, kind: true, courseId: true } },
      oralEvaluation: { select: { aiSuggestedScore: true } },
    },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  if (attempt.exam.kind !== "oral") throw new ExamError("exam_not_oral");
  // "graded" cho phép GV sửa lại quyết định trước đó — không khoá vĩnh viễn.
  // "auto_submitted" — cron hết giờ đóng buổi thi thay vì học viên tự kết
  // thúc; vẫn là buổi đã xong, chấm được như "submitted".
  if (
    attempt.status !== "submitted" &&
    attempt.status !== "auto_submitted" &&
    attempt.status !== "graded"
  ) {
    throw new ExamError("attempt_not_submitted");
  }
  return attempt;
}

export interface OralAttemptGradingView {
  evaluation: OralExamEvaluation | null;
  turns: OralExamTurn[];
}

/** GV xem lại toàn bộ transcript + điểm AI đề xuất (nếu đã sinh) để chấm. */
export async function getOralEvaluation(
  actorUserId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<OralAttemptGradingView> {
  const attempt = await loadOralAttemptForGrading(attemptId, db);
  await assertCanEditCourse(actorUserId, attempt.exam.courseId, db);
  const [evaluation, turns] = await Promise.all([
    db.oralExamEvaluation.findUnique({ where: { attemptId } }),
    db.oralExamTurn.findMany({ where: { attemptId }, orderBy: { createdAt: "asc" } }),
  ]);
  return { evaluation, turns };
}

const SubmitOralEvaluationInput = z.object({
  score: z.number().min(0).max(100),
  notes: z.string().max(5_000).trim().optional(),
});

/**
 * GV chốt điểm cuối cùng — trùng với điểm AI đề xuất thì status="approved",
 * khác (hoặc AI chưa từng đề xuất) thì "overridden". Đây là điểm DUY NHẤT
 * có ý nghĩa với sinh viên; aiSuggestedScore chỉ để tham khảo nội bộ GV.
 */
export async function submitOralEvaluation(
  actorUserId: string,
  attemptId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const attempt = await loadOralAttemptForGrading(attemptId, db);
  await assertCanEditCourse(actorUserId, attempt.exam.courseId, db);
  const parsed = SubmitOralEvaluationInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const { score, notes } = parsed.data;

  const aiScore = attempt.oralEvaluation?.aiSuggestedScore ?? null;
  const status = aiScore !== null && score === aiScore ? "approved" : "overridden";
  const gradedAt = new Date();

  await db.$transaction([
    db.oralExamEvaluation.upsert({
      where: { attemptId },
      create: {
        attemptId,
        instructorScore: score,
        instructorNotes: notes ?? null,
        status,
        gradedById: actorUserId,
        gradedAt,
      },
      update: {
        instructorScore: score,
        instructorNotes: notes ?? null,
        status,
        gradedById: actorUserId,
        gradedAt,
      },
    }),
    db.examAttempt.update({ where: { id: attemptId }, data: { status: "graded" } }),
  ]);

  // Không dùng eventKey — GV sửa điểm lại là 1 hành động chấm mới, có ý
  // nghĩa riêng, không phải retry của lần chấm trước.
  await emitEvent(
    actorUserId,
    LearningEventType.ExamOralEvaluationGraded,
    { examId: attempt.exam.id, attemptId, instructorScore: score, status },
    { courseId: attempt.exam.courseId },
    db,
  );
}
