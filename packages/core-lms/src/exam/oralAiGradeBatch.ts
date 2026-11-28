import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditExam, CourseAuthzError } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { submitOralEvaluation } from "./oral-evaluation";

/**
 * Chấm vấn đáp bằng AI hàng loạt (docs/tieu-chi/cham-van-dap-bang-ai-hang-loat.md).
 *
 * File này chỉ giữ phần KHÔNG gọi AI: chọn lượt, vòng đời của một "lô", chốt theo đề xuất. Lời gọi AI nằm ở
 * apps/web (core-lms không import core-feedback — CLAUDE.md §4.3) và đi qua `generateOralExamEvaluation`.
 *
 * Đề xuất của AI nằm sẵn ở `OralExamEvaluation` (aiSuggested*), tách khỏi điểm chốt (instructor*). Điểm chỉ có hiệu
 * lực khi qua `submitOralEvaluation` — kể cả "Chốt theo đề xuất AI" ở đây.
 */

export class OralAiGradeBatchError extends Error {
  constructor(
    public readonly code: "forbidden" | "exam_not_found" | "exam_not_oral" | "batch_running" | "nothing_to_grade",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// ─── Chọn lượt (hàm thuần) ──────────────────────────────────────────────────────────────────────────────────

export type OralAiGradeExcludeReason = "already_graded" | "has_suggestion" | "no_student_answer";

export interface OralAiGradeCandidate {
  attemptId: string;
  status: "submitted" | "auto_submitted" | "graded";
  submittedAt: Date | null;
  /** Số lượt hội thoại của sinh viên có chữ. */
  studentTurns: number;
  /** Tổng số ký tự của cả hội thoại (giám khảo + sinh viên). */
  transcriptChars: number;
  /** Đã có điểm AI đề xuất đọc được. */
  hasSuggestion: boolean;
}

export interface OralAiGradeTarget {
  attemptId: string;
  estimatedTokens: number;
}

// Ước lượng, không phải số đo. Tiếng Việt ~3 ký tự/token; cộng phần đầu ra (JSON điểm + nhận xét) và khung prompt.
const CHARS_PER_TOKEN = 3;
const FIXED_OVERHEAD_TOKENS = 800;
const MAX_ESTIMATE_TOKENS = 30_000;

export function estimateOralAiGradeTokens(transcriptChars: number, rubricChars: number): number {
  const t = FIXED_OVERHEAD_TOKENS + Math.ceil((Math.max(0, transcriptChars) + Math.max(0, rubricChars)) / CHARS_PER_TOKEN);
  return Math.min(t, MAX_ESTIMATE_TOKENS);
}

export function selectOralAiGradeTargets(
  rows: OralAiGradeCandidate[],
  opts: { includeExisting?: boolean; rubricChars?: number },
): { targets: OralAiGradeTarget[]; excluded: { attemptId: string; reason: OralAiGradeExcludeReason }[] } {
  const excluded: { attemptId: string; reason: OralAiGradeExcludeReason }[] = [];
  const targets: OralAiGradeTarget[] = [];
  const sorted = [...rows].sort(
    (a, b) =>
      (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0) || a.attemptId.localeCompare(b.attemptId),
  );
  for (const r of sorted) {
    if (r.status === "graded") {
      excluded.push({ attemptId: r.attemptId, reason: "already_graded" });
      continue;
    }
    if (r.studentTurns === 0) {
      excluded.push({ attemptId: r.attemptId, reason: "no_student_answer" });
      continue;
    }
    if (!opts.includeExisting && r.hasSuggestion) {
      excluded.push({ attemptId: r.attemptId, reason: "has_suggestion" });
      continue;
    }
    targets.push({
      attemptId: r.attemptId,
      estimatedTokens: estimateOralAiGradeTokens(r.transcriptChars, opts.rubricChars ?? 0),
    });
  }
  return { targets, excluded };
}

// ─── Nạp dữ liệu + kế hoạch ─────────────────────────────────────────────────────────────────────────────────

async function authorize(userId: string, examId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, kind: true, courseId: true, createdById: true, oralRubricText: true },
  });
  if (!exam) throw new OralAiGradeBatchError("exam_not_found");
  if (exam.kind !== "oral") throw new OralAiGradeBatchError("exam_not_oral");
  try {
    await assertCanEditExam(userId, exam, db);
  } catch (e) {
    if (e instanceof CourseAuthzError) throw new OralAiGradeBatchError("forbidden");
    throw e;
  }
  return exam;
}

async function loadCandidates(examId: string, db: PrismaClient): Promise<OralAiGradeCandidate[]> {
  const rows = await db.examAttempt.findMany({
    where: { examId, status: { in: ["submitted", "auto_submitted", "graded"] } },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      oralEvaluation: { select: { aiSuggestedScore: true } },
      oralTurns: { select: { role: true, content: true } },
    },
  });
  return rows.map((r) => ({
    attemptId: r.id,
    status: r.status as OralAiGradeCandidate["status"],
    submittedAt: r.submittedAt,
    studentTurns: r.oralTurns.filter((t) => t.role === "student" && t.content.trim().length > 0).length,
    transcriptChars: r.oralTurns.reduce((n, t) => n + t.content.length, 0),
    hasSuggestion: r.oralEvaluation?.aiSuggestedScore != null,
  }));
}

/** Chỉ đọc: những lượt sẽ chạy và ước lượng token — cho hộp xác nhận. */
export async function planOralAiGradeBatch(
  userId: string,
  examId: string,
  opts: { includeExisting?: boolean },
  db: PrismaClient = prisma,
) {
  const exam = await authorize(userId, examId, db);
  const { targets, excluded } = selectOralAiGradeTargets(await loadCandidates(examId, db), {
    ...opts,
    rubricChars: exam.oralRubricText?.length ?? 0,
  });
  return {
    targets,
    excluded,
    estimatedTokens: targets.reduce((n, t) => n + t.estimatedTokens, 0),
  };
}

// ─── Vòng đời của lô ────────────────────────────────────────────────────────────────────────────────────────

/** Quá mốc này mà lô vẫn `running` thì coi như mất người chạy (worker chết, Redis bị xoá). */
export const ORAL_STALE_BATCH_MS = 2 * 60 * 60 * 1000;

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string }).code === "P2002";
}

export async function startOralAiGradeBatch(
  userId: string,
  examId: string,
  opts: { includeExisting?: boolean; limit?: number },
  db: PrismaClient = prisma,
): Promise<{ batchId: string; total: number }> {
  const plan = await planOralAiGradeBatch(userId, examId, opts, db);
  const dead = await db.oralAiGradeBatch.findMany({
    where: { examId, status: "running", startedAt: { lt: new Date(Date.now() - ORAL_STALE_BATCH_MS) } },
    select: { id: true },
  });
  for (const d of dead) await finishOralAiGradeBatch(d.id, { status: "halted", haltReason: "timeout" }, db);
  let ids = plan.targets.map((t) => t.attemptId);
  if (opts.limit != null) ids = ids.slice(0, Math.max(0, opts.limit));
  if (ids.length === 0) throw new OralAiGradeBatchError("nothing_to_grade");

  const exam = await db.exam.findUniqueOrThrow({ where: { id: examId }, select: { courseId: true } });
  try {
    return await db.$transaction(async (tx) => {
      const batch = await tx.oralAiGradeBatch.create({
        data: { examId, startedById: userId, queue: ids, total: ids.length },
        select: { id: true },
      });
      await emitEvent(
        userId,
        LearningEventType.GradingOralBatchStarted,
        { examId, batchId: batch.id, total: ids.length },
        { courseId: exam.courseId },
        tx,
      );
      return { batchId: batch.id, total: ids.length };
    });
  } catch (e) {
    // Chỉ mục duy nhất từng phần: mỗi đề tối đa một lô đang chạy.
    if (isUniqueViolation(e)) throw new OralAiGradeBatchError("batch_running");
    throw e;
  }
}

export interface OralAiGradeBatchView {
  id: string;
  status: "running" | "completed" | "stopped" | "halted";
  total: number;
  done: number;
  failed: number;
  skipped: number;
  tokensUsed: number;
  stopRequested: boolean;
  haltReason: string | null;
  problems: { attemptId: string; code: string }[];
  startedAt: Date;
  finishedAt: Date | null;
}

/** Lô đang chạy, nếu không có thì lô gần nhất. */
export async function getOralAiGradeBatch(
  userId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<OralAiGradeBatchView | null> {
  await authorize(userId, examId, db);
  const b =
    (await db.oralAiGradeBatch.findFirst({ where: { examId, status: "running" } })) ??
    (await db.oralAiGradeBatch.findFirst({ where: { examId }, orderBy: { startedAt: "desc" } }));
  if (!b) return null;
  return {
    id: b.id,
    status: b.status,
    total: b.total,
    done: b.done,
    failed: b.failed,
    skipped: b.skipped,
    tokensUsed: b.tokensUsed,
    stopRequested: b.stopRequested,
    haltReason: b.haltReason,
    problems: (b.problems as { attemptId: string; code: string }[] | null) ?? [],
    startedAt: b.startedAt,
    finishedAt: b.finishedAt,
  };
}

export async function requestStopOralAiGradeBatch(
  userId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<{ stopped: boolean }> {
  await authorize(userId, examId, db);
  const r = await db.oralAiGradeBatch.updateMany({ where: { examId, status: "running" }, data: { stopRequested: true } });
  return { stopped: r.count > 0 };
}

/** Cho người chạy lô (worker/inline) — không kiểm quyền, đã kiểm lúc tạo lô. `cursor` = số lượt đã xử lý. */
export async function loadOralAiGradeBatchForRunner(batchId: string, db: PrismaClient = prisma) {
  const b = await db.oralAiGradeBatch.findUnique({ where: { id: batchId } });
  if (!b) return null;
  return {
    id: b.id,
    examId: b.examId,
    startedById: b.startedById,
    status: b.status,
    stopRequested: b.stopRequested,
    queue: b.queue as string[],
    cursor: b.done + b.failed + b.skipped,
  };
}

export type OralAiGradeBatchOutcome =
  | { kind: "done"; attemptId: string; tokens: number }
  | { kind: "failed" | "skipped"; attemptId: string; code: string };

/** Mỗi lượt trong hàng đợi tăng đúng một bộ đếm, nên cursor = done + failed + skipped và chạy tiếp được sau retry. */
export async function recordOralAiGradeBatchProgress(
  batchId: string,
  o: OralAiGradeBatchOutcome,
  db: PrismaClient = prisma,
) {
  if (o.kind === "done") {
    await db.oralAiGradeBatch.update({
      where: { id: batchId },
      data: { done: { increment: 1 }, tokensUsed: { increment: Math.max(0, o.tokens) } },
    });
    return;
  }
  // Một người chạy tuần tự mỗi lô nên đọc-rồi-ghi danh sách vấn đề là an toàn.
  const b = await db.oralAiGradeBatch.findUnique({ where: { id: batchId }, select: { problems: true } });
  const problems = [
    ...((b?.problems as { attemptId: string; code: string }[] | null) ?? []),
    { attemptId: o.attemptId, code: o.code },
  ];
  await db.oralAiGradeBatch.update({
    where: { id: batchId },
    data: {
      ...(o.kind === "failed" ? { failed: { increment: 1 } } : { skipped: { increment: 1 } }),
      problems: problems as Prisma.InputJsonValue,
    },
  });
}

/** Idempotent: chỉ lần đầu chuyển khỏi `running` mới phát sự kiện. */
export async function finishOralAiGradeBatch(
  batchId: string,
  o: { status: "completed" | "stopped" | "halted"; haltReason?: string },
  db: PrismaClient = prisma,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const r = await tx.oralAiGradeBatch.updateMany({
      where: { id: batchId, status: "running" },
      data: { status: o.status, haltReason: o.haltReason ?? null, finishedAt: new Date() },
    });
    if (r.count === 0) return;
    const b = await tx.oralAiGradeBatch.findUniqueOrThrow({ where: { id: batchId } });
    const exam = await tx.exam.findUnique({ where: { id: b.examId }, select: { courseId: true } });
    await emitEvent(
      b.startedById,
      LearningEventType.GradingOralBatchCompleted,
      {
        examId: b.examId,
        batchId: b.id,
        total: b.total,
        done: b.done,
        failed: b.failed,
        skipped: b.skipped,
        tokensUsed: b.tokensUsed,
        status: o.status,
        ...(o.haltReason ? { haltReason: o.haltReason } : {}),
      },
      { courseId: exam?.courseId ?? null },
      tx,
    );
  });
}

// ─── Chốt theo đề xuất ──────────────────────────────────────────────────────────────────────────────────────

export type OralAiGradeApplySkipReason = "no_suggestion" | "already_graded" | "failed";

// `instructorNotes` (sinh viên thấy) tối đa 5.000 ký tự — xem SubmitOralEvaluationInput.
const MAX_NOTES = 5_000;

/**
 * Chốt theo đề xuất AI cho các lượt giảng viên đã chọn. Đi qua `submitOralEvaluation` (cùng kiểm quyền, cùng sự
 * kiện). Điểm giữ ĐÚNG điểm AI đề xuất nên `status = approved`; nhận xét tóm tắt của AI được ghi làm ghi chú cho sinh
 * viên (giao diện đã nói rõ ở hộp xác nhận). Lượt đã chốt hoặc chưa có đề xuất thì bỏ qua và nêu lý do.
 */
export async function applyOralAiSuggestions(
  userId: string,
  examId: string,
  attemptIds: string[],
  db: PrismaClient = prisma,
): Promise<{ applied: string[]; skipped: { attemptId: string; reason: OralAiGradeApplySkipReason }[] }> {
  await authorize(userId, examId, db);
  const rows = await db.examAttempt.findMany({
    where: { id: { in: attemptIds }, examId },
    select: { id: true, status: true, oralEvaluation: { select: { aiSuggestedScore: true, aiSummary: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const applied: string[] = [];
  const skipped: { attemptId: string; reason: OralAiGradeApplySkipReason }[] = [];

  for (const id of attemptIds) {
    const r = byId.get(id);
    const ev = r?.oralEvaluation;
    if (!r || !ev || ev.aiSuggestedScore == null) {
      skipped.push({ attemptId: id, reason: "no_suggestion" });
      continue;
    }
    if (r.status === "graded") {
      skipped.push({ attemptId: id, reason: "already_graded" });
      continue;
    }
    try {
      const notes = ev.aiSummary?.trim().slice(0, MAX_NOTES);
      await submitOralEvaluation(userId, id, { score: ev.aiSuggestedScore, ...(notes ? { notes } : {}) }, db);
      applied.push(id);
    } catch {
      skipped.push({ attemptId: id, reason: "failed" });
    }
  }
  return { applied, skipped };
}
