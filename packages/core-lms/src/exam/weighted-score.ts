/**
 * Trọng số theo Phần của đề thi — điểm % CHÍNH THỨC của một bài.
 *
 *   điểm % = Σ (điểm đạt của phần ÷ điểm tối đa của phần × trọng số của phần)
 *
 * Điểm thô (attempt.score = tổng điểm các câu) KHÔNG đổi. Chỉ attempt.scorePct,
 * và mọi nơi đọc nó (trang kết quả, file xuất, kết quả học viên), mang trọng số.
 *
 * Trọng số chỉ có hiệu lực khi đủ MỌI điều kiện — thiếu một điều kiện thì điểm
 * tính theo tỉ lệ điểm như trước và `reason` nói rõ vì sao. Lý do: một điểm "có
 * trọng số một nửa" (phần thiếu trọng số, câu nằm ngoài phần) là điểm sai mà
 * không ai biết, tệ hơn là không áp dụng.
 *
 * Bài còn câu chờ chấm tay vẫn chưa có điểm % (null) — quy tắc cũ, không đổi.
 */

import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { z } from "zod";
import { assertCanEditExam } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { ExamError } from "./types";

export const WEIGHT_SUM_EPS = 0.001;

export type WeightInactiveReason =
  | "no_weights"
  | "single_section"
  | "incomplete"
  | "sum"
  | "orphans"
  | "not_fixed"
  | "empty_section";

export interface ScoringSectionInput {
  id: string;
  title: string;
  weight: number | null;
  selectionMode: "fixed" | "random_from_bank";
  questions: Array<{ id: string; points: number }>;
}

export interface ScoringSection {
  id: string;
  title: string;
  weight: number | null;
  questionIds: string[];
  maxPoints: number;
}

export interface ScoringPlan {
  /** Trọng số đang có hiệu lực. */
  weighted: boolean;
  /** Vì sao chưa có hiệu lực; null khi `weighted`. */
  reason: WeightInactiveReason | null;
  totalPoints: number;
  weightSum: number;
  /** Số câu không thuộc phần nào. */
  orphanQuestionCount: number;
  sections: ScoringSection[];
}

/**
 * Pure. `questions` là TẤT CẢ câu của đề (để biết câu nào nằm ngoài phần);
 * `sections[].questions` là câu thuộc từng phần.
 */
export function buildScoringPlan(
  sections: ScoringSectionInput[],
  questions: Array<{ id: string; points: number }>,
): ScoringPlan {
  const inSection = new Set(sections.flatMap((s) => s.questions.map((q) => q.id)));
  const orphanQuestionCount = questions.filter((q) => !inSection.has(q.id)).length;
  const outSections: ScoringSection[] = sections.map((s) => ({
    id: s.id,
    title: s.title,
    weight: s.weight,
    questionIds: s.questions.map((q) => q.id),
    maxPoints: s.questions.reduce((sum, q) => sum + q.points, 0),
  }));
  const weightSum = sections.reduce((sum, s) => sum + (s.weight ?? 0), 0);

  let reason: WeightInactiveReason | null = null;
  if (sections.every((s) => s.weight === null)) reason = "no_weights";
  else if (sections.length < 2) reason = "single_section";
  else if (sections.some((s) => s.weight === null)) reason = "incomplete";
  else if (Math.abs(weightSum - 100) > WEIGHT_SUM_EPS) reason = "sum";
  else if (orphanQuestionCount > 0) reason = "orphans";
  else if (sections.some((s) => s.selectionMode !== "fixed")) reason = "not_fixed";
  else if (outSections.some((s) => s.maxPoints <= 0)) reason = "empty_section";

  return {
    weighted: reason === null,
    reason,
    totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
    weightSum,
    orphanQuestionCount,
    sections: outSections,
  };
}

/**
 * Điểm % của một bài. `scoreOf` = điểm hiệu lực từng câu (câu chưa có điểm coi
 * như 0; nơi gọi chỉ gọi khi bài đã chấm xong). `rawScore` dùng cho nhánh tỉ lệ.
 */
export function scorePctFor(
  plan: ScoringPlan,
  scoreOf: Map<string, number>,
  rawScore: number,
): number {
  if (!plan.weighted) return plan.totalPoints > 0 ? (rawScore / plan.totalPoints) * 100 : 0;
  let pct = 0;
  for (const s of plan.sections) {
    const got = s.questionIds.reduce((sum, id) => sum + (scoreOf.get(id) ?? 0), 0);
    pct += (got / s.maxPoints) * (s.weight as number);
  }
  return pct;
}

/** "Phần 1 40% · Phần 2 60%" khi trọng số đang áp dụng; null khi điểm tính theo tỉ lệ điểm. */
export function describeWeights(plan: ScoringPlan): string | null {
  if (!plan.weighted) return null;
  return plan.sections
    .map((s) => `${s.title} ${String(Math.round((s.weight as number) * 100) / 100).replace(".", ",")}%`)
    .join(" · ");
}

export async function loadScoringPlan(
  examId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<ScoringPlan> {
  const [sections, questions] = await Promise.all([
    db.examSection.findMany({
      where: { examId },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        title: true,
        weight: true,
        selectionMode: true,
        items: { select: { question: { select: { id: true, points: true } } } },
      },
    }),
    db.examQuestion.findMany({ where: { examId }, select: { id: true, points: true } }),
  ]);
  return buildScoringPlan(
    sections.map((s) => ({
      id: s.id,
      title: s.title,
      weight: s.weight,
      selectionMode: s.selectionMode,
      questions: s.items.map((i) => i.question),
    })),
    questions,
  );
}

// ---------------------------------------------------------------------------
// Đặt trọng số + tính lại bài đã chấm
// ---------------------------------------------------------------------------

const SetWeightsInput = z.object({
  weights: z
    .array(z.object({ sectionId: z.string().uuid(), weight: z.number().min(0).max(100).nullable() }))
    .max(100),
  confirmRecalc: z.boolean().optional(),
});

const REASON_MESSAGE: Record<Exclude<WeightInactiveReason, "no_weights">, string> = {
  single_section: "Đề cần từ 2 phần trở lên mới đặt được trọng số.",
  incomplete: "Phải nhập trọng số cho mọi phần.",
  sum: "Tổng trọng số phải bằng 100%.",
  orphans: "Còn câu hỏi chưa thuộc phần nào. Xếp các câu đó vào một phần trước khi đặt trọng số.",
  not_fixed: "Chỉ đặt được trọng số khi mọi phần đều là phần cố định (không rút ngẫu nhiên từ ngân hàng).",
  empty_section: "Có phần chưa có câu hỏi nào (hoặc tổng điểm bằng 0).",
};

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

async function loadEditableExam(actorUserId: string, examId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, createdById: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  return exam;
}

export interface SectionWeightsInfo {
  sections: Array<{
    id: string;
    title: string;
    weight: number | null;
    maxPoints: number;
    questionCount: number;
    selectionMode: "fixed" | "random_from_bank";
  }>;
  /** Trọng số đang có hiệu lực với điểm của bài. */
  active: boolean;
  reason: WeightInactiveReason | null;
  weightSum: number;
  orphanQuestionCount: number;
  /** Bài đã chấm xong — sẽ được tính lại khi đổi trọng số. */
  scoredAttempts: number;
  inProgressAttempts: number;
}

export async function getSectionWeights(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<SectionWeightsInfo> {
  await loadEditableExam(actorUserId, examId, db);
  const [plan, scoredAttempts, inProgressAttempts, selection] = await Promise.all([
    loadScoringPlan(examId, db),
    db.examAttempt.count({ where: { examId, status: { in: ["submitted", "auto_submitted", "graded"] }, scorePct: { not: null } } }),
    db.examAttempt.count({ where: { examId, status: "in_progress" } }),
    db.examSection.findMany({ where: { examId }, select: { id: true, selectionMode: true } }),
  ]);
  const mode = new Map(selection.map((s) => [s.id, s.selectionMode]));
  return {
    sections: plan.sections.map((s) => ({
      id: s.id,
      title: s.title,
      weight: s.weight,
      maxPoints: s.maxPoints,
      questionCount: s.questionIds.length,
      selectionMode: mode.get(s.id) ?? "fixed",
    })),
    active: plan.weighted,
    reason: plan.reason,
    weightSum: plan.weightSum,
    orphanQuestionCount: plan.orphanQuestionCount,
    scoredAttempts,
    inProgressAttempts,
  };
}

/** Một đề có phần nào đã đặt trọng số chưa — dùng để chặn thêm/xoá phần. */
export async function examHasSectionWeights(
  examId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<boolean> {
  return (await db.examSection.count({ where: { examId, weight: { not: null } } })) > 0;
}

export interface SetWeightsResult {
  weighted: boolean;
  attemptsRecomputed: number;
}

/**
 * Đặt (hoặc bỏ, khi `weights` rỗng / mọi giá trị null) trọng số các phần của đề,
 * rồi tính lại điểm % của mọi bài đã chấm xong trong CÙNG transaction.
 *
 * Chặn khi còn bài đang làm (đổi giữa chừng làm các bài không cùng điều kiện) và
 * khi đã có bài chấm xong mà chưa `confirmRecalc` — giao diện hỏi lại giáo viên.
 */
export async function setSectionWeights(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<SetWeightsResult> {
  const exam = await loadEditableExam(actorUserId, examId, db);
  const parsed = SetWeightsInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());

  const before = await loadScoringPlan(examId, db);
  const known = new Set(before.sections.map((s) => s.id));
  for (const w of parsed.data.weights)
    if (!known.has(w.sectionId)) throw new ExamError("section_not_found");

  const proposed = new Map(parsed.data.weights.map((w) => [w.sectionId, w.weight]));
  const clearing = [...proposed.values()].every((w) => w === null);
  const nextWeight = (id: string): number | null => (clearing ? null : (proposed.get(id) ?? null));

  const after = await loadPlanWithWeights(examId, nextWeight, db);
  if (!clearing && after.reason !== null) {
    const reason = after.reason as Exclude<WeightInactiveReason, "no_weights">;
    const extra =
      reason === "sum"
        ? { sum: after.weightSum, message: `Tổng trọng số đang là ${fmt(after.weightSum)}%, ${
            after.weightSum < 100 ? `còn thiếu ${fmt(100 - after.weightSum)}%` : `thừa ${fmt(after.weightSum - 100)}%`
          }.` }
        : reason === "orphans"
          ? { count: after.orphanQuestionCount, message: REASON_MESSAGE.orphans }
          : { message: REASON_MESSAGE[reason] };
    throw new ExamError("validation_failed", { reason: `weights_${reason}`, ...extra });
  }

  const [inProgress, scored] = await Promise.all([
    db.examAttempt.count({ where: { examId, status: "in_progress" } }),
    db.examAttempt.count({ where: { examId, status: { in: ["submitted", "auto_submitted", "graded"] }, scorePct: { not: null } } }),
  ]);
  if (inProgress > 0)
    throw new ExamError("validation_failed", {
      reason: "attempts_in_progress",
      count: inProgress,
      message: `Đang có ${inProgress} thí sinh làm bài. Đợi các em nộp bài xong rồi mới đổi trọng số.`,
    });

  const changed = before.sections.some((s) => s.weight !== nextWeight(s.id));
  if (changed && scored > 0 && !parsed.data.confirmRecalc)
    throw new ExamError("validation_failed", {
      reason: "confirm_required",
      attempts: scored,
      message: `Sẽ tính lại điểm của ${scored} bài đã chấm xong.`,
    });

  let attemptsRecomputed = 0;
  await db.$transaction(async (tx) => {
    for (const s of before.sections)
      if (s.weight !== nextWeight(s.id))
        await tx.examSection.update({ where: { id: s.id }, data: { weight: nextWeight(s.id) } });

    if (changed) attemptsRecomputed = await recomputeScoredAttempts(examId, after, tx);

    await emitEvent(
      actorUserId,
      LearningEventType.ExamWeightsUpdated,
      {
        examId,
        before: before.sections.map((s) => ({ sectionId: s.id, weight: s.weight })),
        after: before.sections.map((s) => ({ sectionId: s.id, weight: nextWeight(s.id) })),
        weighted: after.weighted,
        attemptsRecomputed,
      },
      { courseId: exam.courseId ?? undefined, eventKey: `${LearningEventType.ExamWeightsUpdated}:${examId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}` },
      tx,
    );
  });
  return { weighted: after.weighted, attemptsRecomputed };
}

/** Kế hoạch tính điểm NẾU các phần mang trọng số `weightOf` — dùng để kiểm tra trước khi lưu. */
async function loadPlanWithWeights(
  examId: string,
  weightOf: (sectionId: string) => number | null,
  db: PrismaClient,
): Promise<ScoringPlan> {
  const [sections, questions] = await Promise.all([
    db.examSection.findMany({
      where: { examId },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        title: true,
        selectionMode: true,
        items: { select: { question: { select: { id: true, points: true } } } },
      },
    }),
    db.examQuestion.findMany({ where: { examId }, select: { id: true, points: true } }),
  ]);
  return buildScoringPlan(
    sections.map((s) => ({
      id: s.id,
      title: s.title,
      weight: weightOf(s.id),
      selectionMode: s.selectionMode,
      questions: s.items.map((i) => i.question),
    })),
    questions,
  );
}

/**
 * Tính lại điểm % của các bài đã chấm xong. Bài còn câu chờ chấm (scorePct = null)
 * giữ nguyên — chấm xong sẽ tự có điểm theo trọng số.
 */
async function recomputeScoredAttempts(
  examId: string,
  plan: ScoringPlan,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const attempts = await tx.examAttempt.findMany({
    where: { examId, status: { in: ["submitted", "auto_submitted", "graded"] }, scorePct: { not: null } },
    select: { id: true, score: true, scorePct: true },
  });
  let n = 0;
  for (const a of attempts) {
    const answers = await tx.examAnswer.findMany({
      where: { attemptId: a.id },
      select: { questionId: true, autoScore: true, manualScore: true },
    });
    const scoreOf = new Map(answers.map((x) => [x.questionId, x.manualScore ?? x.autoScore ?? 0]));
    const raw = a.score ?? [...scoreOf.values()].reduce((s, v) => s + v, 0);
    const pct = scorePctFor(plan, scoreOf, raw);
    if (a.scorePct === null || Math.abs(a.scorePct - pct) > 1e-9) {
      await tx.examAttempt.update({ where: { id: a.id }, data: { scorePct: pct } });
      n++;
    }
  }
  return n;
}
