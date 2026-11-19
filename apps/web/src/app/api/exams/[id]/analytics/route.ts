import { NextResponse } from "next/server";
import { Prisma, prisma } from "@feedbackme/db";
import {
  assertCanEditExam,
  computeItemStatsForRun,
  reliabilityFromMatrix,
  runAttemptWhere,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * A5.4 — Chỉ số từng câu + độ tin cậy của đề.
 *
 * `?sessionId=<uuid>` giới hạn vào MỘT đợt thi: p-value, độ phân biệt,
 * Cronbach α, phân tích phương án nhiễu đều tính riêng trên bài làm của đợt
 * đó. Không truyền thì đọc số đã chốt sẵn trong ExamQuestionStats (cron hằng
 * đêm gộp mọi đợt) — giữ nguyên hành vi cũ.
 *
 * Số của một đợt KHÔNG ghi đè lên số tổng: tính tại chỗ rồi trả về.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, courseId: true, createdById: true },
  });
  if (!exam)
    return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  try {
    await assertCanEditExam(userId, exam);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  // Chỉ số theo đợt tính tại chỗ; không có sessionId thì dùng bản đã chốt.
  const perRun = sessionId
    ? await computeItemStatsForRun(exam.id, sessionId)
    : null;

  const rows = await prisma.examQuestion.findMany({
    where: { examId: exam.id },
    orderBy: { orderInExam: "asc" },
    select: { id: true, prompt: true, type: true, points: true, orderInExam: true, stats: true },
  });

  const items = rows.map((r) => {
    const s = perRun ? (perRun.get(r.id) ?? null) : r.stats;
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
      // Chỉ bản đã chốt mới có mốc thời gian; số theo đợt tính ngay lúc gọi.
      computedAt: perRun ? null : (r.stats?.computedAt?.toISOString() ?? null),
      flags,
    };
  });

  // ── Exam-level reliability (Cronbach α) + score distribution ────────
  const [reliability, distribution, pendingGrading] = await Promise.all([
    computeReliability(exam.id, sessionId),
    computeDistribution(exam.id, sessionId),
    countPendingGrading(exam.id, sessionId),
  ]);

  return NextResponse.json({ items, reliability, distribution, pendingGrading });
}

// ─── Cronbach α + mean/SD from graded attempt scores ───────────────────────

interface Reliability {
  n: number;           // số bài đã chấm xong đưa vào tính
  mean: number;        // điểm TB (%)
  sd: number;          // độ lệch chuẩn điểm tổng (%)
  alpha: number;       // Cronbach α (-1 = không tính được / âm)
  computedAt: string;
}

/**
 * Bài còn câu chờ chấm tay bị LOẠI khỏi mọi thống kê tổng: câu đó chưa có điểm
 * (autoScore/manualScore đều null), tính như 0 điểm sẽ kéo điểm TB xuống và
 * làm méo α. Số bài bị loại được trả riêng để giao diện nói rõ.
 */
const fullyGraded: Prisma.ExamAttemptWhereInput = {
  answers: { none: { needsGrading: true } },
};

async function countPendingGrading(
  examId: string,
  sessionId: string | null,
): Promise<number> {
  return prisma.examAttempt.count({
    where: { ...runAttemptWhere(examId, sessionId), answers: { some: { needsGrading: true } } },
  });
}

async function computeReliability(
  examId: string,
  sessionId: string | null,
): Promise<Reliability | null> {
  const attempts = await prisma.examAttempt.findMany({
    where: { AND: [runAttemptWhere(examId, sessionId), fullyGraded] },
    select: {
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

  const questionIds = [
    ...new Set(attempts.flatMap((a) => a.answers.map((ans) => ans.questionId))),
  ];

  // Hàng = bài làm, cột = câu hỏi, ô = tỉ lệ điểm đạt được (0..1).
  const matrix: number[][] = attempts.map((a) =>
    questionIds.map((qId) => {
      const ans = a.answers.find((x) => x.questionId === qId);
      if (!ans) return 0;
      const awarded = ans.manualScore ?? ans.autoScore ?? 0;
      const max = ans.question.points;
      return max > 0 ? awarded / max : 0;
    }),
  );

  const stats = reliabilityFromMatrix(matrix);
  return stats ? { ...stats, computedAt: new Date().toISOString() } : null;
}

// ─── Score distribution (10 % bins) ───────────────────────────────────────────

interface DistBin { bin: number; label: string; count: number }

async function computeDistribution(
  examId: string,
  sessionId: string | null,
): Promise<DistBin[] | null> {
  const attempts = await prisma.examAttempt.findMany({
    where: { AND: [runAttemptWhere(examId, sessionId), fullyGraded, { scorePct: { not: null } }] },
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
