import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { gradeExamAnswer, type GradeResult } from "./grading";
import { ExamError } from "./types";

interface QuestionWithAnswer {
  id: string;
  type: string;
  config: unknown;
  points: number;
  answer: {
    id: string;
    answerJson: unknown;
    autoScore: number | null;
    manualScore: number | null;
  } | null;
}

async function loadAttemptForGrading(attemptId: string, db: PrismaClient) {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          courseId: true,
          passScore: true,
          showResultsAfterSubmit: true,
        },
      },
    },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  return attempt;
}

async function loadQuestionsWithAnswers(
  examId: string,
  attemptId: string,
  db: PrismaClient,
): Promise<QuestionWithAnswer[]> {
  const questions = await db.examQuestion.findMany({
    where: { examId },
    select: {
      id: true,
      type: true,
      config: true,
      points: true,
      answers: {
        where: { attemptId },
        select: { id: true, answerJson: true, autoScore: true, manualScore: true },
        take: 1,
      },
    },
  });
  return questions.map((q) => ({
    id: q.id,
    type: q.type,
    config: q.config,
    points: q.points,
    answer: q.answers[0] ?? null,
  }));
}

/**
 * Apply per-question auto-graders. Returns whether grading reached terminal
 * state (all questions have a score). Idempotent: re-running yields the same
 * results because graders are pure.
 */
async function applyAutoGrading(
  attemptId: string,
  questions: QuestionWithAnswer[],
  db: PrismaClient,
): Promise<{ autoScore: number; allGraded: boolean }> {
  let autoScore = 0;
  let allGraded = true;
  await (db as typeof prisma).$transaction(async (tx) => {
    for (const q of questions) {
      let result: GradeResult;
      const answerJson = q.answer?.answerJson ?? null;
      if (answerJson === null) {
        // Unanswered. Essays still go to grading queue; auto-types get 0.
        result =
          q.type === "essay" || q.type === "short_answer"
            ? { autoScore: null, needsGrading: true }
            : { autoScore: 0, needsGrading: false };
      } else {
        result = gradeExamAnswer(q.type as Parameters<typeof gradeExamAnswer>[0], q.config, answerJson, q.points);
      }

      if (q.answer) {
        await tx.examAnswer.update({
          where: { id: q.answer.id },
          data: {
            autoScore: result.autoScore,
            needsGrading: result.needsGrading,
          },
        });
      } else {
        // No row yet — create one so the grading queue + result endpoint see it.
        await tx.examAnswer.create({
          data: {
            attemptId,
            questionId: q.id,
            answerJson: undefined,
            autoScore: result.autoScore,
            needsGrading: result.needsGrading,
          },
        });
      }

      const effective = result.autoScore ?? q.answer?.manualScore ?? null;
      if (effective === null) allGraded = false;
      else autoScore += effective;
    }
  });
  return { autoScore, allGraded };
}

interface SubmitResult {
  autoScore: number;
  fullyGraded: boolean;
  status: "submitted" | "auto_submitted" | "graded";
}

async function finalizeSubmission(
  attemptId: string,
  reason: "manual" | "timer_expired",
  db: PrismaClient,
): Promise<SubmitResult> {
  const attempt = await loadAttemptForGrading(attemptId, db);
  if (attempt.status !== "in_progress") {
    // Idempotent: don't re-grade or re-emit. Return current state.
    const score = attempt.score ?? 0;
    return {
      autoScore: score,
      fullyGraded: attempt.status === "graded",
      status: attempt.status as SubmitResult["status"],
    };
  }
  const questions = await loadQuestionsWithAnswers(attempt.examId, attemptId, db);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  const { autoScore, allGraded } = await applyAutoGrading(attemptId, questions, db);

  const now = new Date();
  const nextStatus = allGraded ? "graded" : reason === "manual" ? "submitted" : "auto_submitted";
  const scorePct = totalPoints > 0 ? (autoScore / totalPoints) * 100 : 0;
  const passed = allGraded ? scorePct >= attempt.exam.passScore : null;

  await db.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: nextStatus,
      submittedAt: now,
      gradedAt: allGraded ? now : null,
      score: autoScore,
      scorePct: allGraded ? scorePct : null,
      passed,
    },
  });

  const eventType =
    reason === "manual"
      ? LearningEventType.ExamSubmitted
      : LearningEventType.ExamAutoSubmitted;
  await emitEvent(
    attempt.userId,
    eventType,
    {
      examId: attempt.examId,
      attemptId,
      autoScore,
      fullyGraded: allGraded,
      ...(reason === "timer_expired" ? { reason: "timer_expired" as const } : {}),
    },
    {
      courseId: attempt.exam.courseId,
      eventKey: `${eventType}:${attemptId}`,
    },
    db,
  );

  if (allGraded) {
    await emitEvent(
      attempt.userId,
      LearningEventType.ExamGraded,
      {
        examId: attempt.examId,
        attemptId,
        score: autoScore,
        scorePct,
        passed: passed ?? false,
      },
      {
        courseId: attempt.exam.courseId,
        eventKey: `exam.graded:${attemptId}`,
      },
      db,
    );
  }

  return { autoScore, fullyGraded: allGraded, status: nextStatus };
}

/** A7.5.1 — Manual submit by learner. */
export async function submitExamAttempt(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<SubmitResult> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, status: true },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  if (attempt.userId !== userId) throw new ExamError("attempt_belongs_to_other");
  return finalizeSubmission(attemptId, "manual", db);
}

/**
 * A7.5.2 — Auto-submit all attempts past their deadline. Designed for a cron
 * tick (every minute). Idempotent: re-running picks up nothing new.
 */
export async function autoSubmitExpiredAttempts(
  db: PrismaClient = prisma,
): Promise<{ processed: number; errors: number }> {
  const now = new Date();
  // Find in-progress attempts whose deadline has passed.
  const candidates = await db.examAttempt.findMany({
    where: { status: "in_progress" },
    select: { id: true, startedAt: true, durationSec: true },
    take: 500,
  });
  let processed = 0;
  let errors = 0;
  for (const a of candidates) {
    const deadline = a.startedAt.getTime() + a.durationSec * 1000;
    if (deadline > now.getTime()) continue;
    try {
      await finalizeSubmission(a.id, "timer_expired", db);
      processed++;
    } catch {
      errors++;
    }
  }
  return { processed, errors };
}

/** A7.5.4 — Result for learner. Hides correct answers if exam.showResultsAfterSubmit=false. */
export async function getExamAttemptResult(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
) {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          passScore: true,
          showResultsAfterSubmit: true,
        },
      },
      answers: {
        select: {
          id: true,
          questionId: true,
          autoScore: true,
          manualScore: true,
          needsGrading: true,
          comment: true,
        },
      },
    },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  if (attempt.userId !== userId) throw new ExamError("attempt_belongs_to_other");
  if (attempt.status === "in_progress") {
    throw new ExamError("validation_failed", "attempt_in_progress");
  }
  const isFinal = attempt.status === "graded";
  return {
    attemptId,
    examId: attempt.examId,
    examTitle: attempt.exam.title,
    status: attempt.status,
    score: isFinal ? attempt.score : null,
    scorePct: isFinal ? attempt.scorePct : null,
    passed: isFinal ? attempt.passed : null,
    passScore: attempt.exam.passScore,
    showDetails: attempt.exam.showResultsAfterSubmit && isFinal,
    answers: attempt.answers.map((a) => ({
      questionId: a.questionId,
      autoScore: a.autoScore,
      manualScore: a.manualScore,
      needsGrading: a.needsGrading,
      comment: a.comment,
    })),
  };
}
