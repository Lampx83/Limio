/**
 * A5.4 — Item analytics computation (P2.5 T5-D2+D3).
 *
 * For each ExamQuestion with ≥1 submitted attempt:
 *   - attemptCount, correctCount → p-value (correct / attempted)
 *   - discrimination = point-biserial correlation between item correctness
 *     and the candidate's total exam score
 *   - distractorStats (MCQ/multi): per-option chosen-by counts
 *
 * Then aggregates ExamQuestionStats up into BankQuestionStats for each
 * BankQuestion via ExamQuestionFromBank links.
 *
 * Designed to run nightly (cron 02:00) on the full corpus. Idempotent —
 * UPSERT per row, no diff churn.
 *
 * Sentinel rules: when n < MIN_ATTEMPTS, pValue stays -1 and discrimination
 * stays -2 so consumers can hide / flag "chưa đủ dữ liệu".
 */

import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse, canEditCourse } from "../courses/authz";
import { ExamError } from "./types";

const MIN_ATTEMPTS = 5;
export const ITEM_ANALYTICS_MIN_ATTEMPTS = MIN_ATTEMPTS;

/** An answer counts as "correct" when awarded ≥ 99% of max points. */
function isCorrect(awarded: number | null, max: number): boolean {
  if (awarded === null) return false;
  if (max <= 0) return awarded > 0;
  return awarded / max >= 0.99;
}

/**
 * Compute stats for every ExamQuestion in a single exam. Recomputes from
 * scratch (replaces any prior row via upsert). Returns counters.
 */
export async function computeExamAnalytics(
  examId: string,
  db: PrismaClient = prisma,
): Promise<{ questionsScanned: number; statsWritten: number }> {
  // Load all submitted/graded attempts + their answers + question metadata.
  const attempts = await db.examAttempt.findMany({
    where: {
      examId,
      status: { in: ["submitted", "auto_submitted", "graded"] },
    },
    select: {
      id: true,
      score: true,
      scorePct: true,
      answers: {
        select: {
          questionId: true,
          answerJson: true,
          autoScore: true,
          manualScore: true,
          question: { select: { type: true, points: true, config: true } },
        },
      },
    },
  });

  if (attempts.length < 1) {
    // No data — nothing to write. Caller may still see old stats from prior runs.
    return { questionsScanned: 0, statsWritten: 0 };
  }

  // Total-score (per attempt) used as the discriminating variable.
  // Fall back to scorePct → 0 if neither set.
  const totalByAttempt = new Map<string, number>();
  for (const a of attempts) {
    const total = a.score ?? a.scorePct ?? 0;
    totalByAttempt.set(a.id, total);
  }

  // Pivot answers by questionId.
  type AnswerSample = {
    attemptId: string;
    correct: boolean;
    totalScore: number;
    answerJson: unknown;
    type: string;
    points: number;
    config: unknown;
  };
  const samplesByQuestion = new Map<string, AnswerSample[]>();
  for (const a of attempts) {
    for (const ans of a.answers) {
      const awarded = ans.manualScore ?? ans.autoScore;
      const sample: AnswerSample = {
        attemptId: a.id,
        correct: isCorrect(awarded, ans.question.points),
        totalScore: totalByAttempt.get(a.id) ?? 0,
        answerJson: ans.answerJson,
        type: ans.question.type,
        points: ans.question.points,
        config: ans.question.config,
      };
      if (!samplesByQuestion.has(ans.questionId))
        samplesByQuestion.set(ans.questionId, []);
      samplesByQuestion.get(ans.questionId)!.push(sample);
    }
  }

  let statsWritten = 0;
  for (const [questionId, samples] of samplesByQuestion) {
    const stats = computeStatsForQuestion(samples);
    const writable = {
      attemptCount: stats.attemptCount,
      correctCount: stats.correctCount,
      pValue: stats.pValue,
      discrimination: stats.discrimination,
      avgTimeSec: stats.avgTimeSec,
      distractorStats:
        stats.distractorStats === null
          ? Prisma.JsonNull
          : (stats.distractorStats as Prisma.InputJsonValue),
      computedAt: new Date(),
    };
    await db.examQuestionStats.upsert({
      where: { examQuestionId: questionId },
      create: { examQuestionId: questionId, ...writable },
      update: writable,
    });
    statsWritten++;
  }

  return { questionsScanned: samplesByQuestion.size, statsWritten };
}

interface QuestionStatsPayload {
  attemptCount: number;
  correctCount: number;
  pValue: number;
  discrimination: number;
  avgTimeSec: number | null;
  distractorStats: unknown;
}

export function computeStatsForQuestion(
  samples: { correct: boolean; totalScore: number; answerJson: unknown; type: string; config: unknown }[],
): QuestionStatsPayload {
  const attemptCount = samples.length;
  const correctCount = samples.filter((s) => s.correct).length;
  const pValue = attemptCount >= MIN_ATTEMPTS ? correctCount / attemptCount : -1;

  // Point-biserial correlation between item correctness (0/1) and total exam score.
  // r_pb = (M1 - M0) / sd * sqrt(p * q)
  let discrimination = -2;
  if (attemptCount >= MIN_ATTEMPTS && correctCount > 0 && correctCount < attemptCount) {
    const totals = samples.map((s) => s.totalScore);
    const mean = totals.reduce((s, x) => s + x, 0) / totals.length;
    const variance =
      totals.reduce((s, x) => s + (x - mean) ** 2, 0) / totals.length;
    const sd = Math.sqrt(variance);
    if (sd > 0) {
      const correctTotals = samples.filter((s) => s.correct).map((s) => s.totalScore);
      const incorrectTotals = samples.filter((s) => !s.correct).map((s) => s.totalScore);
      const m1 = correctTotals.reduce((s, x) => s + x, 0) / correctTotals.length;
      const m0 = incorrectTotals.reduce((s, x) => s + x, 0) / incorrectTotals.length;
      const p = correctCount / attemptCount;
      const q = 1 - p;
      discrimination = ((m1 - m0) / sd) * Math.sqrt(p * q);
    }
  }

  // Distractor analysis for MCQ/multi only.
  let distractorStats: unknown = null;
  if (samples[0]?.type === "mcq" || samples[0]?.type === "multi") {
    const config = samples[0].config as { options?: { id: string; isCorrect: boolean }[] };
    const optionMeta = new Map(
      (config.options ?? []).map((o) => [o.id, o.isCorrect ?? false]),
    );
    const counts: Record<string, { chosenBy: number; isCorrect: boolean }> = {};
    for (const id of optionMeta.keys()) {
      counts[id] = { chosenBy: 0, isCorrect: optionMeta.get(id) ?? false };
    }
    for (const s of samples) {
      const a = s.answerJson as
        | { selectedOptionId?: string; selectedOptionIds?: string[] }
        | null;
      const chosen =
        a?.selectedOptionId !== undefined
          ? [a.selectedOptionId]
          : a?.selectedOptionIds ?? [];
      for (const id of chosen) {
        if (!counts[id]) counts[id] = { chosenBy: 0, isCorrect: optionMeta.get(id) ?? false };
        counts[id].chosenBy++;
      }
    }
    distractorStats = counts;
  }

  return {
    attemptCount,
    correctCount,
    pValue,
    discrimination,
    avgTimeSec: null, // per-question time not tracked at storage layer
    distractorStats,
  };
}

/**
 * Rebuild BankQuestionStats from current ExamQuestionStats. For each
 * BankQuestion that's been used in ≥1 exam, aggregate weighted by attemptCount.
 */
export async function computeBankAnalytics(
  db: PrismaClient = prisma,
): Promise<{ banksScanned: number; statsWritten: number }> {
  // All ExamQuestionFromBank rows joined with stats of the exam-side question.
  const links = await db.examQuestionFromBank.findMany({
    select: {
      bankQuestionId: true,
      examQuestion: {
        select: { stats: { select: { attemptCount: true, correctCount: true, pValue: true, discrimination: true } } },
      },
    },
  });

  type Agg = { uses: number; attempts: number; pSum: number; pW: number; dSum: number; dW: number };
  const byBank = new Map<string, Agg>();
  for (const l of links) {
    const a = byBank.get(l.bankQuestionId) ?? {
      uses: 0,
      attempts: 0,
      pSum: 0,
      pW: 0,
      dSum: 0,
      dW: 0,
    };
    a.uses++;
    const s = l.examQuestion?.stats;
    if (s && s.attemptCount > 0) {
      a.attempts += s.attemptCount;
      if (s.pValue >= 0) {
        a.pSum += s.pValue * s.attemptCount;
        a.pW += s.attemptCount;
      }
      if (s.discrimination >= -1) {
        a.dSum += s.discrimination * s.attemptCount;
        a.dW += s.attemptCount;
      }
    }
    byBank.set(l.bankQuestionId, a);
  }

  let statsWritten = 0;
  for (const [bankQuestionId, a] of byBank) {
    await db.bankQuestionStats.upsert({
      where: { bankQuestionId },
      create: {
        bankQuestionId,
        totalUses: a.uses,
        totalAttempts: a.attempts,
        pValueAvg: a.pW > 0 ? a.pSum / a.pW : -1,
        discriminationAvg: a.dW > 0 ? a.dSum / a.dW : -2,
        computedAt: new Date(),
      },
      update: {
        totalUses: a.uses,
        totalAttempts: a.attempts,
        pValueAvg: a.pW > 0 ? a.pSum / a.pW : -1,
        discriminationAvg: a.dW > 0 ? a.dSum / a.dW : -2,
        computedAt: new Date(),
      },
    });
    statsWritten++;
  }
  return { banksScanned: byBank.size, statsWritten };
}

/**
 * Full nightly sweep. Iterates every Exam with ≥1 submitted attempt, runs the
 * per-exam computation, then aggregates Bank stats once at the end.
 */
export async function computeAllAnalytics(
  db: PrismaClient = prisma,
): Promise<{
  examsProcessed: number;
  questionsWritten: number;
  banksWritten: number;
  durationMs: number;
}> {
  const t0 = Date.now();
  const exams = await db.exam.findMany({
    where: { attempts: { some: { status: { in: ["submitted", "auto_submitted", "graded"] } } } },
    select: { id: true },
  });
  let questionsWritten = 0;
  for (const e of exams) {
    const r = await computeExamAnalytics(e.id, db);
    questionsWritten += r.statsWritten;
  }
  const bank = await computeBankAnalytics(db);
  return {
    examsProcessed: exams.length,
    questionsWritten,
    banksWritten: bank.statsWritten,
    durationMs: Date.now() - t0,
  };
}

// =====================================================================
// Read-side services for the /instructor/item-analytics page.
// Cron writes ExamQuestionStats nightly — these helpers just read them.
// =====================================================================

export interface ItemAnalyticsRow {
  questionId: string;
  orderInExam: number;
  prompt: string;
  type: string;
  points: number;
  /** -1 = chưa đủ dữ liệu (n < MIN_ATTEMPTS). */
  pValue: number;
  /** -2 = chưa đủ dữ liệu. */
  discrimination: number;
  attemptCount: number;
  correctCount: number;
  avgTimeSec: number | null;
  distractorStats: unknown;
  /** Options snapshot for distractor analysis UI (MCQ/multi only). */
  options: { id: string; label: string; isCorrect: boolean; misconceptionCode?: string | null }[] | null;
  skillTags: { skillId: string; skillName: string; skillCode: string }[];
  computedAt: Date | null;
}

export interface ExamItemAnalyticsResult {
  exam: { id: string; title: string; courseId: string };
  rows: ItemAnalyticsRow[];
}

/**
 * Read item analytics for one exam. Authz: actor must be able to edit the
 * exam's course (CourseInstructor or admin).
 */
export async function listExamItemAnalytics(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<ExamItemAnalyticsResult> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, courseId: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditCourse(actorUserId, exam.courseId, db);

  const questions = await db.examQuestion.findMany({
    where: { examId },
    orderBy: [{ orderInExam: "asc" }],
    select: {
      id: true,
      orderInExam: true,
      prompt: true,
      type: true,
      points: true,
      config: true,
      stats: {
        select: {
          attemptCount: true,
          correctCount: true,
          pValue: true,
          discrimination: true,
          avgTimeSec: true,
          distractorStats: true,
          computedAt: true,
        },
      },
      skillTags: {
        select: {
          skillId: true,
          skill: { select: { name: true, code: true } },
        },
      },
    },
  });

  const rows: ItemAnalyticsRow[] = questions.map((q) => {
    let options: ItemAnalyticsRow["options"] = null;
    if ((q.type === "mcq" || q.type === "multi") && q.config) {
      const cfg = q.config as {
        options?: { id: string; label?: string; isCorrect?: boolean; misconceptionCode?: string | null }[];
      };
      options =
        cfg.options?.map((o) => ({
          id: o.id,
          label: o.label ?? "",
          isCorrect: !!o.isCorrect,
          misconceptionCode: o.misconceptionCode ?? null,
        })) ?? null;
    }
    const s = q.stats;
    return {
      questionId: q.id,
      orderInExam: q.orderInExam,
      prompt: q.prompt,
      type: q.type,
      points: q.points,
      pValue: s?.pValue ?? -1,
      discrimination: s?.discrimination ?? -2,
      attemptCount: s?.attemptCount ?? 0,
      correctCount: s?.correctCount ?? 0,
      avgTimeSec: s?.avgTimeSec ?? null,
      distractorStats: s?.distractorStats ?? null,
      options,
      skillTags: q.skillTags.map((t) => ({
        skillId: t.skillId,
        skillName: t.skill.name,
        skillCode: t.skill.code,
      })),
      computedAt: s?.computedAt ?? null,
    };
  });

  return { exam, rows };
}

export interface BankItemAnalyticsRow {
  bankQuestionId: string;
  prompt: string;
  type: string;
  totalUses: number;
  totalAttempts: number;
  pValueAvg: number;
  discriminationAvg: number;
  computedAt: Date | null;
}

export interface BankItemAnalyticsResult {
  bank: { id: string; name: string };
  rows: BankItemAnalyticsRow[];
}

/**
 * Read aggregated bank-question analytics. Authz: actor must own the bank, or
 * be an instructor of its course (for visibility="course").
 */
export async function listBankItemAnalytics(
  actorUserId: string,
  bankId: string,
  db: PrismaClient = prisma,
): Promise<BankItemAnalyticsResult> {
  const bank = await db.questionBank.findUnique({
    where: { id: bankId },
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      visibility: true,
      courseId: true,
    },
  });
  if (!bank) throw new ExamError("bank_not_found");
  const isOwner = bank.ownerUserId === actorUserId;
  let allowed = isOwner;
  if (!allowed && bank.visibility === "course" && bank.courseId) {
    allowed = await canEditCourse(actorUserId, bank.courseId, db);
  }
  if (!allowed) throw new ExamError("bank_not_found");

  const questions = await db.bankQuestion.findMany({
    where: { bankId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      prompt: true,
      type: true,
      stats: {
        select: {
          totalUses: true,
          totalAttempts: true,
          pValueAvg: true,
          discriminationAvg: true,
          computedAt: true,
        },
      },
    },
  });

  const rows: BankItemAnalyticsRow[] = questions.map((q) => ({
    bankQuestionId: q.id,
    prompt: q.prompt,
    type: q.type,
    totalUses: q.stats?.totalUses ?? 0,
    totalAttempts: q.stats?.totalAttempts ?? 0,
    pValueAvg: q.stats?.pValueAvg ?? -1,
    discriminationAvg: q.stats?.discriminationAvg ?? -2,
    computedAt: q.stats?.computedAt ?? null,
  }));

  return { bank: { id: bank.id, name: bank.name }, rows };
}
