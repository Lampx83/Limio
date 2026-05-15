import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A5.4 — Per-exam item analytics + exam-level reliability stats. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, courseId: true },
  });
  if (!exam)
    return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  try {
    await assertCanEditCourse(userId, exam.courseId);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  const rows = await prisma.examQuestion.findMany({
    where: { examId: exam.id },
    orderBy: { orderInExam: "asc" },
    select: { id: true, prompt: true, type: true, points: true, orderInExam: true, stats: true },
  });

  const items = rows.map((r) => {
    const s = r.stats;
    const flags: string[] = [];
    if (s && s.attemptCount >= 5) {
      if (s.pValue >= 0 && s.pValue < 0.2) flags.push("too_hard");
      if (s.pValue > 0.95) flags.push("too_easy");
      if (s.discrimination >= -1 && s.discrimination < 0.1) flags.push("low_discrimination");
    }
    return {
      id: r.id,
      orderInExam: r.orderInExam,
      prompt: r.prompt.slice(0, 200),
      type: r.type,
      points: r.points,
      attemptCount: s?.attemptCount ?? 0,
      correctCount: s?.correctCount ?? 0,
      pValue: s?.pValue ?? -1,
      discrimination: s?.discrimination ?? -2,
      distractorStats: s?.distractorStats ?? null,
      computedAt: s?.computedAt?.toISOString() ?? null,
      flags,
    };
  });

  // ── Exam-level reliability (Cronbach α) + score distribution ────────
  const [reliability, distribution] = await Promise.all([
    computeReliability(exam.id),
    computeDistribution(exam.id),
  ]);

  return NextResponse.json({ items, reliability, distribution });
}

// ─── Cronbach α + mean/SD from graded attempt scores ───────────────────────

interface Reliability {
  n: number;           // number of graded attempts
  mean: number;        // mean total score (%)
  sd: number;          // SD of total scores
  alpha: number;       // Cronbach α (-1 = insufficient data)
  computedAt: string;
}

async function computeReliability(examId: string): Promise<Reliability | null> {
  const MIN_N = 5;

  // Load graded attempt scores + per-question binary responses.
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId,
      status: { in: ["submitted", "auto_submitted", "graded"] },
    },
    select: {
      id: true,
      scorePct: true,
      answers: {
        select: {
          questionId: true,
          autoScore: true,
          manualScore: true,
          question: { select: { points: true } },
        },
      },
    },
  });

  if (attempts.length < MIN_N) return null;

  // Build score matrix: attempt × question → proportion-correct (0..1)
  const questionIds = [
    ...new Set(attempts.flatMap((a) => a.answers.map((ans) => ans.questionId))),
  ];
  if (questionIds.length < 2) return null;

  const matrix: number[][] = attempts.map((a) =>
    questionIds.map((qId) => {
      const ans = a.answers.find((x) => x.questionId === qId);
      if (!ans) return 0;
      const awarded = ans.manualScore ?? ans.autoScore ?? 0;
      const max = ans.question.points;
      return max > 0 ? awarded / max : 0;
    }),
  );

  // Total scores per attempt (sum of item proportions, scaled to 0..100 %)
  const k = questionIds.length;
  const totals = matrix.map((row) =>
    (row.reduce((s, x) => s + x, 0) / k) * 100,
  );

  const n = totals.length;
  const mean = totals.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(totals.reduce((s, x) => s + (x - mean) ** 2, 0) / n);

  // Cronbach α = k/(k-1) * (1 − Σσᵢ²/σ²_total)
  const totalVariance = totals.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  if (totalVariance === 0) return { n, mean, sd, alpha: -1, computedAt: new Date().toISOString() };

  const itemVarianceSum = questionIds.reduce((sum, _, qi) => {
    const colScores = matrix.map((row) => (row[qi] ?? 0) * 100);
    const colMean = colScores.reduce((s, x) => s + x, 0) / n;
    const colVar = colScores.reduce((s, x) => s + (x - colMean) ** 2, 0) / n;
    return sum + colVar;
  }, 0);

  const alpha = (k / (k - 1)) * (1 - itemVarianceSum / totalVariance);

  return {
    n,
    mean: Math.round(mean * 10) / 10,
    sd: Math.round(sd * 10) / 10,
    alpha: Math.round(Math.max(-1, Math.min(1, alpha)) * 100) / 100,
    computedAt: new Date().toISOString(),
  };
}

// ─── Score distribution (10 % bins) ───────────────────────────────────────────

interface DistBin { bin: number; label: string; count: number }

async function computeDistribution(examId: string): Promise<DistBin[] | null> {
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId,
      status: { in: ["submitted", "auto_submitted", "graded"] },
      scorePct: { not: null },
    },
    select: { scorePct: true },
  });
  if (attempts.length < 5) return null;

  const bins: DistBin[] = Array.from({ length: 10 }, (_, i) => ({
    bin: i,
    label: `${i * 10}–${i * 10 + 10}%`,
    count: 0,
  }));
  for (const { scorePct } of attempts) {
    const idx = Math.min(Math.floor((scorePct ?? 0) / 10), 9);
    bins[idx]!.count++;
  }
  return bins;
}
