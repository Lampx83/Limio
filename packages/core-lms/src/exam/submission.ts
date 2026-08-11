import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { gradeExamAnswer, type GradeResult } from "./grading";
import { assertSubjectOwnsAttempt, type ExamSubject } from "./subject";
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

export interface ExamSubmitResult {
  autoScore: number;
  fullyGraded: boolean;
  status: "submitted" | "auto_submitted" | "graded";
}

/**
 * Shared finalisation path. `force_submitted` keeps semantics identical to
 * `manual` (status=submitted, treated as deliberate end-of-attempt) and is used
 * by A5.3.5 instructor force-submit action; the caller emits the distinct
 * audit event.
 */
export async function finalizeSubmission(
  attemptId: string,
  reason: "manual" | "timer_expired" | "force_submitted",
  db: PrismaClient,
): Promise<ExamSubmitResult> {
  const attempt = await loadAttemptForGrading(attemptId, db);
  if (attempt.status !== "in_progress") {
    // Idempotent: don't re-grade or re-emit. Return current state.
    const score = attempt.score ?? 0;
    return {
      autoScore: score,
      fullyGraded: attempt.status === "graded",
      status: attempt.status as ExamSubmitResult["status"],
    };
  }
  const questions = await loadQuestionsWithAnswers(attempt.examId, attemptId, db);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  const { autoScore, allGraded } = await applyAutoGrading(attemptId, questions, db);

  const now = new Date();
  const nextStatus = allGraded
    ? "graded"
    : reason === "timer_expired"
      ? "auto_submitted"
      : "submitted";
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
      candidateId: attempt.candidateId ?? undefined,
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
        candidateId: attempt.candidateId ?? undefined,
        eventKey: `exam.graded:${attemptId}`,
      },
      db,
    );
  }

  return { autoScore, fullyGraded: allGraded, status: nextStatus };
}

export interface RegradeExamResult {
  attemptsProcessed: number;
  attemptsChanged: number;
  answersChanged: number;
}

/**
 * Chấm lại TẤT CẢ bài đã nộp của 1 đề theo đáp án hiện tại. Dùng sau khi instructor
 * sửa nội dung/đáp án câu hỏi của đề đã publish (A5).
 *
 * - Chấm lại các câu AUTO (mcq/multi/true_false/gap_fill…) bằng gradeExamAnswer.
 * - KHÔNG đụng câu tự luận (essay/short_answer): giữ nguyên manualScore + trạng
 *   thái chấm tay của giám khảo.
 * - Tính lại attempt.score/scorePct/passed theo passScore hiện tại.
 * - Ghi ExamGradeHistory cho mỗi answer đổi điểm + phát ExamRegraded (audit).
 *
 * Authz do route đảm nhiệm (canEditCourse). `actorUserId` chỉ dùng cho history.
 */
export async function regradeExamAttempts(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<RegradeExamResult> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, passScore: true },
  });
  if (!exam) throw new ExamError("exam_not_found");

  const questions = await db.examQuestion.findMany({
    where: { examId },
    select: { id: true, type: true, config: true, points: true },
  });
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  const attempts = await db.examAttempt.findMany({
    where: {
      examId,
      status: { in: ["submitted", "auto_submitted", "graded"] },
    },
    select: {
      id: true,
      userId: true,
      candidateId: true,
      status: true,
      score: true,
    },
  });

  let attemptsChanged = 0;
  let answersChanged = 0;

  for (const attempt of attempts) {
    const answers = await db.examAnswer.findMany({
      where: { attemptId: attempt.id },
      select: {
        id: true,
        questionId: true,
        answerJson: true,
        autoScore: true,
        manualScore: true,
        needsGrading: true,
      },
    });
    const byQ = new Map(answers.map((a) => [a.questionId, a]));

    let autoAnswersChanged = 0;
    let scoreSum = 0;
    let allGraded = true;

    await (db as typeof prisma).$transaction(async (tx) => {
      for (const q of questions) {
        const a = byQ.get(q.id) ?? null;
        const isAuto = q.type !== "essay" && q.type !== "short_answer";

        if (isAuto) {
          const answerJson = a?.answerJson ?? null;
          const result: GradeResult =
            answerJson === null
              ? { autoScore: 0, needsGrading: false }
              : gradeExamAnswer(
                  q.type as Parameters<typeof gradeExamAnswer>[0],
                  q.config,
                  answerJson,
                  q.points,
                );
          const newAuto = result.autoScore ?? 0;

          if (a) {
            if (a.autoScore !== newAuto || a.needsGrading !== result.needsGrading) {
              await tx.examAnswer.update({
                where: { id: a.id },
                data: { autoScore: newAuto, needsGrading: result.needsGrading },
              });
              await tx.examGradeHistory.create({
                data: {
                  answerId: a.id,
                  oldScore: a.autoScore,
                  newScore: newAuto,
                  reason: "regrade_auto",
                  changedById: actorUserId,
                },
              });
              autoAnswersChanged++;
            }
          } else {
            const created = await tx.examAnswer.create({
              data: {
                attemptId: attempt.id,
                questionId: q.id,
                autoScore: newAuto,
                needsGrading: result.needsGrading,
              },
            });
            await tx.examGradeHistory.create({
              data: {
                answerId: created.id,
                oldScore: null,
                newScore: newAuto,
                reason: "regrade_auto",
                changedById: actorUserId,
              },
            });
            autoAnswersChanged++;
          }
          scoreSum += newAuto;
        } else {
          // Tự luận: giữ nguyên điểm chấm tay.
          const eff = a?.manualScore ?? null;
          if (eff === null) allGraded = false;
          else scoreSum += eff;
        }
      }

      const scorePct = totalPoints > 0 ? (scoreSum / totalPoints) * 100 : 0;
      const nextStatus = allGraded
        ? "graded"
        : attempt.status === "auto_submitted"
          ? "auto_submitted"
          : "submitted";
      const now = new Date();
      await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: nextStatus,
          score: scoreSum,
          scorePct: allGraded ? scorePct : null,
          passed: allGraded ? scorePct >= exam.passScore : null,
          gradedAt: allGraded ? now : null,
        },
      });
    });

    answersChanged += autoAnswersChanged;
    if (autoAnswersChanged > 0 || attempt.score !== scoreSum) {
      attemptsChanged++;
      await emitEvent(
        attempt.userId,
        LearningEventType.ExamRegraded,
        { examId, attemptId: attempt.id, score: scoreSum },
        {
          courseId: exam.courseId,
          candidateId: attempt.candidateId ?? undefined,
        },
        db,
      );
    }
  }

  return {
    attemptsProcessed: attempts.length,
    attemptsChanged,
    answersChanged,
  };
}

export interface MarkAttemptResult {
  status: "submitted" | "auto_submitted" | "graded" | "flagged" | "in_progress";
  alreadyFinalized: boolean;
}

/**
 * Tintin — Mark an in-progress attempt as submitted WITHOUT applying auto-grading.
 * Caller is expected to enqueue auto-grading via BullMQ (handled in the API
 * route, which sees the worker queue). Idempotent: re-calling on a non-
 * in_progress attempt returns alreadyFinalized=true without re-emitting.
 *
 * Used by `submitAttemptMarkOnly` / `forceSubmitAttemptMarkOnly` /
 * `autoSubmitExpiredAttemptsMarkOnly`. Tests + cron-style sync flows still
 * call the legacy `finalizeSubmission` which does mark + grade inline.
 */
export async function markAttemptSubmitted(
  attemptId: string,
  reason: "manual" | "timer_expired" | "force_submitted",
  db: PrismaClient = prisma,
): Promise<MarkAttemptResult> {
  const attempt = await loadAttemptForGrading(attemptId, db);
  if (attempt.status !== "in_progress") {
    return {
      status: attempt.status as MarkAttemptResult["status"],
      alreadyFinalized: true,
    };
  }
  const now = new Date();
  const nextStatus: "submitted" | "auto_submitted" =
    reason === "timer_expired" ? "auto_submitted" : "submitted";
  await db.examAttempt.update({
    where: { id: attemptId },
    data: { status: nextStatus, submittedAt: now },
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
      // autoScore/fullyGraded filled in by the ExamGraded event after worker runs.
      ...(reason === "timer_expired" ? { reason: "timer_expired" as const } : {}),
    },
    {
      courseId: attempt.exam.courseId,
      candidateId: attempt.candidateId ?? undefined,
      eventKey: `${eventType}:${attemptId}`,
    },
    db,
  );
  return { status: nextStatus, alreadyFinalized: false };
}

/**
 * Tintin — Apply auto-grading to an already-marked attempt. Idempotent: if the
 * attempt is already `graded`, returns the existing score without re-running.
 * Throws ExamError("attempt_not_submitted") if the attempt is still
 * in_progress (caller must mark first).
 *
 * Designed to run inside a BullMQ worker so the heavy per-question grading
 * transaction doesn't block the submit HTTP request.
 */
export async function applyAutoGradingForAttempt(
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<ExamSubmitResult> {
  const attempt = await loadAttemptForGrading(attemptId, db);
  if (attempt.status === "graded") {
    return {
      autoScore: attempt.score ?? 0,
      fullyGraded: true,
      status: "graded",
    };
  }
  if (attempt.status === "in_progress") {
    throw new ExamError("attempt_not_submitted");
  }
  const questions = await loadQuestionsWithAnswers(attempt.examId, attemptId, db);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const { autoScore, allGraded } = await applyAutoGrading(attemptId, questions, db);

  const now = new Date();
  const scorePct = totalPoints > 0 ? (autoScore / totalPoints) * 100 : 0;
  const passed = allGraded ? scorePct >= attempt.exam.passScore : null;

  await db.examAttempt.update({
    where: { id: attemptId },
    data: {
      ...(allGraded ? { status: "graded" as const } : {}),
      gradedAt: allGraded ? now : null,
      score: autoScore,
      scorePct: allGraded ? scorePct : null,
      passed,
    },
  });

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
        candidateId: attempt.candidateId ?? undefined,
        eventKey: `exam.graded:${attemptId}`,
      },
      db,
    );
  }

  return {
    autoScore,
    fullyGraded: allGraded,
    status: allGraded ? "graded" : (attempt.status as ExamSubmitResult["status"]),
  };
}

/**
 * Tintin — Mark-only variant of A7.5.1 manual submit. The API route calls this
 * and then enqueues a BullMQ auto-grade job. Tests still use the legacy
 * `submitExamAttempt` (sync grading).
 */
export async function submitAttemptMarkOnly(
  subject: ExamSubject,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<MarkAttemptResult> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, candidateId: true, status: true },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  assertSubjectOwnsAttempt(subject, attempt);
  return markAttemptSubmitted(attemptId, "manual", db);
}

/**
 * Tintin — Mark-only variant of A7.5.2 cron auto-submit. Returns the list of
 * attempt ids that were freshly marked so the caller (API cron route) can
 * enqueue grading jobs for them.
 */
export async function autoSubmitExpiredAttemptsMarkOnly(
  db: PrismaClient = prisma,
): Promise<{ processed: number; errors: number; attemptIds: string[] }> {
  const now = new Date();
  const candidates = await db.examAttempt.findMany({
    where: { status: "in_progress" },
    select: { id: true, startedAt: true, durationSec: true },
    take: 500,
  });
  let processed = 0;
  let errors = 0;
  const attemptIds: string[] = [];
  for (const a of candidates) {
    const deadline = a.startedAt.getTime() + a.durationSec * 1000;
    if (deadline > now.getTime()) continue;
    try {
      const r = await markAttemptSubmitted(a.id, "timer_expired", db);
      if (!r.alreadyFinalized) {
        attemptIds.push(a.id);
        processed++;
      }
    } catch {
      errors++;
    }
  }
  return { processed, errors, attemptIds };
}

/**
 * Recovery scanner: find ExamAttempts in `submitted`/`auto_submitted` state
 * with score=null that haven't been graded — typically because the BullMQ
 * worker was down / Redis dropped at submit time, so the auto-grade job
 * never ran. Re-grades them inline (synchronous, doesn't need worker).
 *
 * Cron-friendly: cap at `batchSize` per tick + 1-minute grace window before
 * picking up a fresh submission (give the worker a chance first).
 *
 * Idempotent — re-running picks up nothing because `applyAutoGradingForAttempt`
 * skips attempts already in `graded` status.
 */
export async function gradeStuckSubmittedAttempts(
  db: PrismaClient = prisma,
  opts: { batchSize?: number; graceMs?: number } = {},
): Promise<{ processed: number; errors: number; attemptIds: string[] }> {
  const batchSize = opts.batchSize ?? 100;
  const graceMs = opts.graceMs ?? 60_000;
  const cutoff = new Date(Date.now() - graceMs);

  const stuck = await db.examAttempt.findMany({
    where: {
      status: { in: ["submitted", "auto_submitted"] },
      score: null,
      submittedAt: { lt: cutoff, not: null },
    },
    select: { id: true },
    take: batchSize,
    orderBy: { submittedAt: "asc" },
  });

  let processed = 0;
  let errors = 0;
  const attemptIds: string[] = [];
  for (const a of stuck) {
    try {
      const r = await applyAutoGradingForAttempt(a.id, db);
      if (r.fullyGraded) {
        attemptIds.push(a.id);
        processed++;
      }
    } catch (e) {
      errors++;
      // Don't throw — keep batch processing the rest.
      console.error(`[gradeStuckSubmittedAttempts] ${a.id} failed:`, e);
    }
  }
  return { processed, errors, attemptIds };
}

/** A7.5.1 — Manual submit by learner (User or candidate). */
export async function submitExamAttempt(
  subject: ExamSubject,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<ExamSubmitResult> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, candidateId: true, status: true },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  assertSubjectOwnsAttempt(subject, attempt);
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

/**
 * Full answer review — only available when exam.showResultsAfterSubmit=true
 * and attempt.status="graded". Returns each question with the learner's
 * submitted answer + correct answer data so the UI can highlight right/wrong.
 */
export interface ExamAttemptReviewQuestion {
  id: string;
  orderInExam: number;
  type: string;
  prompt: string;
  points: number;
  config: unknown;
  explanation: string | null;
  answer: {
    answerJson: unknown;
    score: number | null;
    needsGrading: boolean;
    comment: string | null;
  } | null;
}

export async function getExamAttemptReview(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ examTitle: string; questions: ExamAttemptReviewQuestion[] }> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      examId: true,
      status: true,
      exam: {
        select: {
          title: true,
          showResultsAfterSubmit: true,
          questions: {
            orderBy: { orderInExam: "asc" },
            select: {
              id: true,
              orderInExam: true,
              type: true,
              prompt: true,
              points: true,
              config: true,
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          answerJson: true,
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
  if (attempt.status !== "graded") throw new ExamError("validation_failed", "not_graded_yet");
  if (!attempt.exam.showResultsAfterSubmit) {
    throw new ExamError("validation_failed", "results_hidden");
  }

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  return {
    examTitle: attempt.exam.title,
    questions: attempt.exam.questions.map((q) => {
      const ans = answerMap.get(q.id) ?? null;
      const awarded = ans ? (ans.manualScore ?? ans.autoScore) : null;
      return {
        id: q.id,
        orderInExam: q.orderInExam,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        config: q.config,
        // explanation may be stored inside config.explanation for some question types
        explanation: (q.config as Record<string, unknown>).explanation as string | undefined ?? null,
        answer: ans
          ? {
              answerJson: ans.answerJson,
              score: awarded,
              needsGrading: ans.needsGrading,
              comment: ans.comment,
            }
          : null,
      };
    }),
  };
}
