import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse, CourseAuthzError } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { getRoomScope } from "./room-authz";
import { ExamError } from "./types";

export interface PendingGradeItem {
  id: string;
  questionId: string;
  attemptId: string;
  answerJson: unknown;
  autoScore: number | null;
  manualScore: number | null;
  updatedAt: Date;
  attempt: {
    // A5.8 — null for candidate attempts (open_code / assigned_code).
    userId: string | null;
    submittedAt: Date | null;
    // null for candidate attempts. UI shows candidate.displayName instead.
    user: { id: string; displayName: string; email: string } | null;
  };
  question: {
    id: string;
    type: string;
    prompt: string;
    points: number;
    config: unknown;
  };
}

export const GradeAnswerInput = z.object({
  manualScore: z.number().min(0),
  comment: z.string().max(5_000).optional(),
  reason: z.string().max(500).optional(),
});

/**
 * A7.6.1 — List answers that still need a manual grade for an exam.
 * Oldest submission first so the grader works through them FIFO.
 */
export async function listPendingExamGrades(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<PendingGradeItem[]> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true },
  });
  if (!exam) throw new ExamError("exam_not_found");

  // P1 — instructor sees all; room grader sees only essays of candidates in
  // their graded rooms; nothing else.
  const scope = await getRoomScope(actorUserId, examId, db);
  if (!scope.isInstructor && scope.graderRoomIds.length === 0) {
    throw new CourseAuthzError("forbidden");
  }

  // Restrict candidate scope for non-instructor graders.
  let candidateIdFilter: { in: string[] } | undefined;
  if (!scope.isInstructor) {
    const cands = await db.examCandidate.findMany({
      where: { examId, roomId: { in: scope.graderRoomIds } },
      select: { id: true },
    });
    if (cands.length === 0) return [];
    candidateIdFilter = { in: cands.map((c) => c.id) };
  }

  return db.examAnswer.findMany({
    where: {
      needsGrading: true,
      attempt: {
        examId,
        ...(candidateIdFilter ? { candidateId: candidateIdFilter } : {}),
      },
      question: { type: { in: ["essay", "short_answer"] } },
    },
    select: {
      id: true,
      questionId: true,
      attemptId: true,
      answerJson: true,
      autoScore: true,
      manualScore: true,
      updatedAt: true,
      attempt: {
        select: {
          userId: true,
          submittedAt: true,
          user: { select: { id: true, displayName: true, email: true } },
        },
      },
      question: {
        select: { id: true, type: true, prompt: true, points: true, config: true },
      },
    },
    orderBy: [{ attempt: { submittedAt: "asc" } }, { updatedAt: "asc" }],
    take: 100,
  });
}

interface GradeChange {
  /** True when this is the first grade (no previous manualScore). False on regrade. */
  isInitial: boolean;
  oldScore: number | null;
  newScore: number;
  /** True when this grade was the last pending answer on the attempt. */
  finalized: boolean;
  attemptId: string;
}

/**
 * A7.6.2 / A7.6.3 — Grade or regrade an ESSAY/SHORT answer. Recomputes the
 * attempt's totals; when no `needsGrading` rows remain, transitions attempt to
 * `graded` and emits `exam.graded`. Always writes an audit row in
 * ExamGradeHistory.
 */
export async function gradeManualExamAnswer(
  actorUserId: string,
  answerId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<GradeChange> {
  const parsed = GradeAnswerInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const { manualScore, comment, reason } = parsed.data;

  const answer = await db.examAnswer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      attemptId: true,
      manualScore: true,
      question: {
        select: { id: true, type: true, points: true },
      },
      attempt: {
        select: {
          id: true,
          examId: true,
          userId: true,
          candidateId: true,
          status: true,
          candidate: { select: { roomId: true } },
          exam: { select: { courseId: true, passScore: true } },
        },
      },
    },
  });
  if (!answer) throw new ExamError("answer_not_found");

  // P1 — Instructor full; room grader scoped to candidates whose roomId is
  // among the rooms they grade for this exam.
  const scope = await getRoomScope(
    actorUserId,
    answer.attempt.examId,
    db,
  );
  if (!scope.isInstructor) {
    const roomId = answer.attempt.candidate?.roomId ?? null;
    const allowed =
      roomId !== null && scope.graderRoomIds.includes(roomId);
    if (!allowed) throw new CourseAuthzError("forbidden");
  }

  if (answer.question.type !== "essay" && answer.question.type !== "short_answer") {
    throw new ExamError("not_manual_gradable");
  }
  if (manualScore > answer.question.points) {
    throw new ExamError("score_out_of_range", {
      max: answer.question.points,
    });
  }

  const oldScore = answer.manualScore;
  const isInitial = oldScore === null;
  const now = new Date();

  const result = await (db as typeof prisma).$transaction(async (tx) => {
    await tx.examAnswer.update({
      where: { id: answerId },
      data: {
        manualScore,
        needsGrading: false,
        graderId: actorUserId,
        gradedAt: now,
        ...(comment !== undefined ? { comment } : {}),
      },
    });
    await tx.examGradeHistory.create({
      data: {
        answerId,
        oldScore,
        newScore: manualScore,
        reason: reason ?? null,
        changedById: actorUserId,
      },
    });

    // Recompute attempt totals.
    const rows = await tx.examAnswer.findMany({
      where: { attemptId: answer.attemptId },
      select: {
        autoScore: true,
        manualScore: true,
        needsGrading: true,
      },
    });
    const stillPending = rows.some((r) => r.needsGrading);
    const totalScore = rows.reduce(
      (s, r) => s + (r.manualScore ?? r.autoScore ?? 0),
      0,
    );
    const questions = await tx.examQuestion.findMany({
      where: { examId: answer.attempt.examId },
      select: { points: true },
    });
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);
    const scorePct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
    const passScore = answer.attempt.exam.passScore;

    if (!stillPending) {
      await tx.examAttempt.update({
        where: { id: answer.attemptId },
        data: {
          score: totalScore,
          scorePct,
          passed: scorePct >= passScore,
          status: "graded",
          gradedAt: now,
        },
      });
    } else {
      // Keep attempt in submitted/auto_submitted state; expose interim totals.
      await tx.examAttempt.update({
        where: { id: answer.attemptId },
        data: { score: totalScore },
      });
    }
    return { finalized: !stillPending };
  });

  // Emit events outside the transaction so a failure here doesn't roll back
  // the grade itself. Idempotency keys keep replays safe.
  if (isInitial) {
    if (result.finalized) {
      await emitEvent(
        answer.attempt.userId,
        LearningEventType.ExamGraded,
        {
          examId: answer.attempt.examId,
          attemptId: answer.attemptId,
          // payload exam.graded — recompute from DB for consistency.
        },
        {
          courseId: answer.attempt.exam.courseId,
          eventKey: `exam.graded:${answer.attemptId}`,
        },
        db,
      );
    }
  } else {
    await emitEvent(
      answer.attempt.userId,
      LearningEventType.ExamRegraded,
      {
        attemptId: answer.attemptId,
        answerId,
        questionId: answer.question.id,
        oldScore,
        newScore: manualScore,
        changedBy: actorUserId,
        ...(reason ? { reason } : {}),
      },
      {
        courseId: answer.attempt.exam.courseId,
        // Reasons may be reused — include timestamp via the history row id to
        // make replays unique. Read back the freshest entry.
        eventKey: `exam.regraded:${answerId}:${now.getTime()}`,
      },
      db,
    );
  }

  return {
    isInitial,
    oldScore,
    newScore: manualScore,
    finalized: result.finalized,
    attemptId: answer.attemptId,
  };
}
