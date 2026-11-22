import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { assertCanGradeAssignment, gradeSubmission, loadAssignmentCourse } from "./assignments";

/**
 * Chấm bài tập nộp bằng AI hàng loạt (docs/tieu-chi/cham-bai-tap-bang-ai-hang-loat.md).
 *
 * File này chỉ giữ phần KHÔNG gọi AI: chọn bài, vòng đời của một "lô", lưu gợi ý, chốt theo gợi ý. Lời gọi AI nằm
 * ở apps/web (core-lms không import core-feedback — CLAUDE.md §4.3); nó đọc/ghi qua các hàm ở đây.
 *
 * Nguyên tắc: gợi ý KHÔNG BAO GIỜ tự thành điểm. `AssignmentSubmission.score/status` chỉ đổi qua `gradeSubmission`.
 */

export class AiGradeBatchError extends Error {
  constructor(
    public readonly code: "forbidden" | "assignment_not_found" | "batch_running" | "nothing_to_grade" | "batch_not_found",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// ─── Chọn bài (hàm thuần) ───────────────────────────────────────────────────────────────────────────────────

export type AiGradeExcludeReason = "already_graded" | "has_suggestion" | "empty_submission" | "team_duplicate";

export interface AiGradeCandidate {
  submissionId: string;
  userId: string;
  status: "submitted" | "graded";
  submittedAt: Date;
  updatedAt: Date;
  body: string;
  attachmentUrl: string | null;
  teamId: string | null;
  teamSubmittedAt: Date | null;
  /** `basedOnSubmissionUpdatedAt` của gợi ý hiện có, null nếu chưa có gợi ý. */
  suggestionBasedOn: Date | null;
}

export interface AiGradeTarget {
  submissionId: string;
  estimatedTokens: number;
}

// Ước lượng, không phải số đo: bài ngắn/dài khác nhau và AiUsageLog gộp theo ngày nên không tách được token của
// riêng tính năng này. Cùng giả định với tokenWallet.ts (1,5 token/từ tiếng Việt + 400 token cố định).
const TOKENS_PER_WORD = 1.5;
const FIXED_OVERHEAD_TOKENS = 400;
const ATTACHMENT_ALLOWANCE_TOKENS = 3000;
// AI chỉ đọc tối đa AI_GRADE_CHAR_BUDGET (20.000) ký tự mỗi bài nên chi phí có trần dù bài dài đến đâu.
const MAX_ESTIMATE_TOKENS = 12_000;

export function estimateAiGradeTokens(c: { body: string; attachmentUrl: string | null }): number {
  const text = c.body.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const t = FIXED_OVERHEAD_TOKENS + Math.round(words * TOKENS_PER_WORD) + (c.attachmentUrl ? ATTACHMENT_ALLOWANCE_TOKENS : 0);
  return Math.min(t, MAX_ESTIMATE_TOKENS);
}

/** Gợi ý còn mới = bài nộp chưa đổi kể từ lúc AI đọc nó. */
export function isSuggestionFresh(suggestionBasedOn: Date | null, submissionUpdatedAt: Date): boolean {
  return suggestionBasedOn != null && submissionUpdatedAt.getTime() <= suggestionBasedOn.getTime();
}

export function selectAiGradeTargets(
  rows: AiGradeCandidate[],
  opts: { includeFresh?: boolean },
): { targets: AiGradeTarget[]; excluded: { submissionId: string; reason: AiGradeExcludeReason }[] } {
  const excluded: { submissionId: string; reason: AiGradeExcludeReason }[] = [];

  // Nộp nhóm: chỉ lần nộp mới nhất của mỗi nhóm, và một dòng đại diện cho cả nhóm (gradeSubmission chấm cả nhóm).
  const latestByTeam = new Map<string, number>();
  for (const r of rows) {
    if (r.teamId && r.teamSubmittedAt) {
      const cur = latestByTeam.get(r.teamId) ?? 0;
      latestByTeam.set(r.teamId, Math.max(cur, r.teamSubmittedAt.getTime()));
    }
  }
  const teamSeen = new Set<string>();

  const sorted = [...rows].sort(
    (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime() || a.submissionId.localeCompare(b.submissionId),
  );
  const targets: AiGradeTarget[] = [];
  for (const r of sorted) {
    if (r.status === "graded") {
      excluded.push({ submissionId: r.submissionId, reason: "already_graded" });
      continue;
    }
    if (r.teamId && r.teamSubmittedAt) {
      const isLatest = r.teamSubmittedAt.getTime() === latestByTeam.get(r.teamId);
      if (!isLatest || teamSeen.has(r.teamId)) {
        excluded.push({ submissionId: r.submissionId, reason: "team_duplicate" });
        continue;
      }
      teamSeen.add(r.teamId);
    }
    if (!r.body.trim() && !r.attachmentUrl) {
      excluded.push({ submissionId: r.submissionId, reason: "empty_submission" });
      continue;
    }
    if (!opts.includeFresh && isSuggestionFresh(r.suggestionBasedOn, r.updatedAt)) {
      excluded.push({ submissionId: r.submissionId, reason: "has_suggestion" });
      continue;
    }
    targets.push({ submissionId: r.submissionId, estimatedTokens: estimateAiGradeTokens(r) });
  }
  return { targets, excluded };
}

/** Lấy phần đầu vừa số dư. `overflow` = số bài không vừa. Chỉ chạy phần vừa, không chạy rồi dừng giữa chừng. */
export function fitTargetsToBudget(
  targets: AiGradeTarget[],
  availableTokens: number,
): { fit: AiGradeTarget[]; overflow: number } {
  let used = 0;
  const fit: AiGradeTarget[] = [];
  for (const t of targets) {
    if (used + t.estimatedTokens > availableTokens) break;
    used += t.estimatedTokens;
    fit.push(t);
  }
  return { fit, overflow: targets.length - fit.length };
}

// ─── Nạp dữ liệu + kế hoạch ─────────────────────────────────────────────────────────────────────────────────

async function authorize(userId: string, assignmentId: string, db: PrismaClient) {
  try {
    const scope = await loadAssignmentCourse(assignmentId, db);
    await assertCanGradeAssignment(userId, scope, db);
    return scope;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "assignment_not_found") throw new AiGradeBatchError("assignment_not_found");
    if (code === "forbidden") throw new AiGradeBatchError("forbidden");
    throw e;
  }
}

async function loadCandidates(assignmentId: string, db: PrismaClient): Promise<AiGradeCandidate[]> {
  const rows = await db.assignmentSubmission.findMany({
    where: { assignmentId },
    select: {
      id: true,
      userId: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
      body: true,
      attachmentUrl: true,
      teamId: true,
      teamSubmittedAt: true,
      aiGradeSuggestion: { select: { basedOnSubmissionUpdatedAt: true } },
    },
  });
  return rows.map((r) => ({
    submissionId: r.id,
    userId: r.userId,
    status: r.status,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    body: r.body,
    attachmentUrl: r.attachmentUrl,
    teamId: r.teamId,
    teamSubmittedAt: r.teamSubmittedAt,
    suggestionBasedOn: r.aiGradeSuggestion?.basedOnSubmissionUpdatedAt ?? null,
  }));
}

/** Chỉ đọc: những bài sẽ chạy và ước lượng token — cho hộp xác nhận. */
export async function planAiGradeBatch(
  userId: string,
  assignmentId: string,
  opts: { includeFresh?: boolean },
  db: PrismaClient = prisma,
) {
  await authorize(userId, assignmentId, db);
  const { targets, excluded } = selectAiGradeTargets(await loadCandidates(assignmentId, db), opts);
  return {
    targets,
    excluded,
    estimatedTokens: targets.reduce((n, t) => n + t.estimatedTokens, 0),
  };
}

// ─── Vòng đời của lô ────────────────────────────────────────────────────────────────────────────────────────

/** Một lô lớn nhất chạy được cỡ vài chục bài × vài chục giây; quá mốc này coi như đã mất người chạy. */
export const STALE_BATCH_MS = 2 * 60 * 60 * 1000;

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string }).code === "P2002";
}

export async function startAiGradeBatch(
  userId: string,
  assignmentId: string,
  opts: { includeFresh?: boolean; limit?: number },
  db: PrismaClient = prisma,
): Promise<{ batchId: string; total: number }> {
  const plan = await planAiGradeBatch(userId, assignmentId, opts, db);
  // Lô "đang chạy" quá lâu là lô mất người chạy (worker chết, Redis bị xoá) — đóng lại, nếu không nó chặn mãi.
  const dead = await db.assignmentAiGradeBatch.findMany({
    where: { assignmentId, status: "running", startedAt: { lt: new Date(Date.now() - STALE_BATCH_MS) } },
    select: { id: true },
  });
  for (const d of dead) await finishAiGradeBatch(d.id, { status: "halted", haltReason: "timeout" }, db);
  let ids = plan.targets.map((t) => t.submissionId);
  if (opts.limit != null) ids = ids.slice(0, Math.max(0, opts.limit));
  if (ids.length === 0) throw new AiGradeBatchError("nothing_to_grade");

  try {
    return await db.$transaction(async (tx) => {
      const batch = await tx.assignmentAiGradeBatch.create({
        data: { assignmentId, startedById: userId, queue: ids, total: ids.length },
        select: { id: true },
      });
      await emitEvent(
        userId,
        LearningEventType.GradingAiBatchStarted,
        { assignmentId, batchId: batch.id, total: ids.length },
        { courseId: (await courseIdOf(assignmentId, tx as unknown as PrismaClient)) },
        tx,
      );
      return { batchId: batch.id, total: ids.length };
    });
  } catch (e) {
    // Chỉ mục duy nhất từng phần: mỗi bài tập tối đa một lô đang chạy.
    if (isUniqueViolation(e)) throw new AiGradeBatchError("batch_running");
    throw e;
  }
}

async function courseIdOf(assignmentId: string, db: PrismaClient): Promise<string | null> {
  const s = await loadAssignmentCourse(assignmentId, db);
  return s.courseId;
}

export interface AiGradeBatchView {
  id: string;
  status: "running" | "completed" | "stopped" | "halted";
  total: number;
  done: number;
  failed: number;
  skipped: number;
  tokensUsed: number;
  stopRequested: boolean;
  haltReason: string | null;
  problems: { submissionId: string; code: string }[];
  startedAt: Date;
  finishedAt: Date | null;
}

/** Lô đang chạy, nếu không có thì lô gần nhất. */
export async function getAiGradeBatch(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
): Promise<AiGradeBatchView | null> {
  await authorize(userId, assignmentId, db);
  const b =
    (await db.assignmentAiGradeBatch.findFirst({ where: { assignmentId, status: "running" } })) ??
    (await db.assignmentAiGradeBatch.findFirst({ where: { assignmentId }, orderBy: { startedAt: "desc" } }));
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
    problems: (b.problems as { submissionId: string; code: string }[] | null) ?? [],
    startedAt: b.startedAt,
    finishedAt: b.finishedAt,
  };
}

export async function requestStopAiGradeBatch(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
): Promise<{ stopped: boolean }> {
  await authorize(userId, assignmentId, db);
  const r = await db.assignmentAiGradeBatch.updateMany({
    where: { assignmentId, status: "running" },
    data: { stopRequested: true },
  });
  return { stopped: r.count > 0 };
}

/** Cho người chạy lô (worker/inline) — không kiểm quyền, đã kiểm lúc tạo lô. `cursor` = số bài đã xử lý. */
export async function loadAiGradeBatchForRunner(batchId: string, db: PrismaClient = prisma) {
  const b = await db.assignmentAiGradeBatch.findUnique({ where: { id: batchId } });
  if (!b) return null;
  return {
    id: b.id,
    assignmentId: b.assignmentId,
    startedById: b.startedById,
    status: b.status,
    stopRequested: b.stopRequested,
    queue: b.queue as string[],
    cursor: b.done + b.failed + b.skipped,
  };
}

export type AiGradeBatchOutcome =
  | { kind: "done"; submissionId: string; tokens: number }
  | { kind: "failed" | "skipped"; submissionId: string; code: string };

/** Mỗi bài trong hàng đợi tăng đúng một bộ đếm, nên cursor = done + failed + skipped và chạy tiếp được sau khi retry. */
export async function recordAiGradeBatchProgress(batchId: string, o: AiGradeBatchOutcome, db: PrismaClient = prisma) {
  if (o.kind === "done") {
    await db.assignmentAiGradeBatch.update({
      where: { id: batchId },
      data: { done: { increment: 1 }, tokensUsed: { increment: Math.max(0, o.tokens) } },
    });
    return;
  }
  // Một người chạy tuần tự mỗi lô nên đọc-rồi-ghi danh sách vấn đề là an toàn.
  const b = await db.assignmentAiGradeBatch.findUnique({ where: { id: batchId }, select: { problems: true } });
  const problems = [...((b?.problems as { submissionId: string; code: string }[] | null) ?? []), { submissionId: o.submissionId, code: o.code }];
  await db.assignmentAiGradeBatch.update({
    where: { id: batchId },
    data: {
      ...(o.kind === "failed" ? { failed: { increment: 1 } } : { skipped: { increment: 1 } }),
      problems: problems as Prisma.InputJsonValue,
    },
  });
}

/** Idempotent: chỉ lần đầu chuyển khỏi `running` mới phát sự kiện. */
export async function finishAiGradeBatch(
  batchId: string,
  o: { status: "completed" | "stopped" | "halted"; haltReason?: string },
  db: PrismaClient = prisma,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const r = await tx.assignmentAiGradeBatch.updateMany({
      where: { id: batchId, status: "running" },
      data: { status: o.status, haltReason: o.haltReason ?? null, finishedAt: new Date() },
    });
    if (r.count === 0) return;
    const b = await tx.assignmentAiGradeBatch.findUniqueOrThrow({ where: { id: batchId } });
    await emitEvent(
      b.startedById,
      LearningEventType.GradingAiBatchCompleted,
      {
        assignmentId: b.assignmentId,
        batchId: b.id,
        total: b.total,
        done: b.done,
        failed: b.failed,
        skipped: b.skipped,
        tokensUsed: b.tokensUsed,
        status: o.status,
        ...(o.haltReason ? { haltReason: o.haltReason } : {}),
      },
      { courseId: await courseIdOf(b.assignmentId, tx as unknown as PrismaClient) },
      tx,
    );
  });
}

// ─── Gợi ý ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface AiGradeSuggestionInput {
  score: number;
  feedback: string;
  rationale: string;
  criteria?: { name: string; maxPoints: number; points: number }[] | null;
  hadRubric: boolean;
  readSources?: string[] | null;
  unread?: { what: string; why: string } | null;
  truncated?: { sentChars: number; totalChars: number } | null;
  tokensUsed?: number | null;
  /** `updatedAt` của bài nộp LÚC ĐỌC (trước khi gọi AI), để biết gợi ý còn mới không. */
  basedOnSubmissionUpdatedAt: Date;
}

/** Ghi gợi ý. KHÔNG đụng AssignmentSubmission. */
export async function saveAiGradeSuggestion(
  submissionId: string,
  assignmentId: string,
  batchId: string | null,
  s: AiGradeSuggestionInput,
  db: PrismaClient = prisma,
) {
  const data = {
    assignmentId,
    score: s.score,
    feedback: s.feedback,
    rationale: s.rationale,
    criteria: (s.criteria ?? undefined) as Prisma.InputJsonValue | undefined,
    hadRubric: s.hadRubric,
    readSources: (s.readSources ?? undefined) as Prisma.InputJsonValue | undefined,
    unread: (s.unread ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    truncated: (s.truncated ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    tokensUsed: s.tokensUsed ?? null,
    basedOnSubmissionUpdatedAt: s.basedOnSubmissionUpdatedAt,
    batchId,
  };
  await db.assignmentAiGradeSuggestion.upsert({
    where: { submissionId },
    create: { submissionId, ...data },
    update: data,
  });
}

export interface AiGradeSuggestionView {
  score: number;
  feedback: string;
  rationale: string;
  criteria: { name: string; maxPoints: number; points: number }[] | null;
  hadRubric: boolean;
  readSources: string[] | null;
  unread: { what: string; why: string } | null;
  truncated: { sentChars: number; totalChars: number } | null;
  /** `stale` = học viên đã sửa/nộp lại sau khi AI đọc. */
  state: "fresh" | "stale";
  createdAt: Date;
}

/** Gợi ý của cả bài tập, theo submissionId — chỉ giảng viên đọc được. */
export async function listAiGradeSuggestions(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
): Promise<Record<string, AiGradeSuggestionView>> {
  await authorize(userId, assignmentId, db);
  const rows = await db.assignmentAiGradeSuggestion.findMany({
    where: { assignmentId },
    include: { submission: { select: { updatedAt: true } } },
  });
  const out: Record<string, AiGradeSuggestionView> = {};
  for (const r of rows) {
    out[r.submissionId] = {
      score: r.score,
      feedback: r.feedback,
      rationale: r.rationale,
      criteria: r.criteria as AiGradeSuggestionView["criteria"],
      hadRubric: r.hadRubric,
      readSources: r.readSources as string[] | null,
      unread: r.unread as AiGradeSuggestionView["unread"],
      truncated: r.truncated as AiGradeSuggestionView["truncated"],
      state: isSuggestionFresh(r.basedOnSubmissionUpdatedAt, r.submission.updatedAt) ? "fresh" : "stale",
      createdAt: r.createdAt,
    };
  }
  return out;
}

export type AiGradeApplySkipReason = "no_suggestion" | "stale" | "already_graded" | "score_exceeds_max" | "failed";

/**
 * Chốt theo gợi ý cho các bài giảng viên đã chọn. Đi qua `gradeSubmission` (cùng kiểm quyền, cùng sự kiện), không
 * ghi thẳng DB. Bài đã chấm, chưa có gợi ý, hoặc gợi ý đã cũ thì bỏ qua và nói rõ vì sao.
 */
export async function applyAiGradeSuggestions(
  userId: string,
  assignmentId: string,
  submissionIds: string[],
  db: PrismaClient = prisma,
): Promise<{ applied: string[]; skipped: { submissionId: string; reason: AiGradeApplySkipReason }[] }> {
  const scope = await authorize(userId, assignmentId, db);
  const rows = await db.assignmentSubmission.findMany({
    where: { id: { in: submissionIds }, assignmentId },
    select: { id: true, status: true, updatedAt: true, aiGradeSuggestion: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const applied: string[] = [];
  const skipped: { submissionId: string; reason: AiGradeApplySkipReason }[] = [];

  for (const id of submissionIds) {
    const r = byId.get(id);
    const sug = r?.aiGradeSuggestion;
    if (!r || !sug) {
      skipped.push({ submissionId: id, reason: "no_suggestion" });
      continue;
    }
    // Nộp nhóm: chấm một dòng là cả nhóm đã chấm — dòng kế của cùng nhóm sẽ rơi vào nhánh này.
    if (r.status === "graded") {
      skipped.push({ submissionId: id, reason: "already_graded" });
      continue;
    }
    if (!isSuggestionFresh(sug.basedOnSubmissionUpdatedAt, r.updatedAt)) {
      skipped.push({ submissionId: id, reason: "stale" });
      continue;
    }
    if (sug.score < 0 || sug.score > scope.maxScore) {
      skipped.push({ submissionId: id, reason: "score_exceeds_max" });
      continue;
    }
    try {
      await gradeSubmission(userId, id, { score: sug.score, feedback: sug.feedback }, db);
      applied.push(id);
    } catch {
      skipped.push({ submissionId: id, reason: "failed" });
    }
  }
  return { applied, skipped };
}
