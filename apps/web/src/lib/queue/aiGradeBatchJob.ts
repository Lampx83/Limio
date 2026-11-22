import type { Job } from "bullmq";
import { prisma } from "@feedbackme/db";
import {
  finishAiGradeBatch,
  loadAiGradeBatchForRunner,
  recordAiGradeBatchProgress,
  saveAiGradeSuggestion,
} from "@feedbackme/core-lms";
import { AiGenerationError, AiTutorError } from "@feedbackme/core-feedback";
import { suggestForSubmission } from "../assignmentAiSuggest";
import { getAiGradeBatchQueue, QUEUE_NAMES } from "./index";

/**
 * Chấm bài tập bằng AI hàng loạt (docs/tieu-chi/cham-bai-tap-bang-ai-hang-loat.md, AC2/AC6).
 *
 * Chạy TUẦN TỰ từng bài trong hàng đợi của lô, mỗi bài qua đúng `suggestForSubmission` (cùng đường chấm với nút
 * từng bài). Chỉ lưu gợi ý; không bao giờ ghi điểm. Tiến độ nằm trong DB nên job chạy tiếp được sau khi retry
 * (cursor = số bài đã xử lý) và giao diện đọc được dù đóng trang.
 */
export type AiGradeBatchJobData = { batchId: string };
export type AiGradeBatchJobResult = { batchId: string; status: string };

/** Hết ví hoặc chạm trần: dừng sạch cả lô, giữ gợi ý đã có, để giảng viên chạy tiếp sau khi nạp. */
const HALT_CODES = new Set(["no_token_budget", "global_token_cap", "daily_token_cap", "rate_limited"]);

export async function runAiGradeBatch(batchId: string): Promise<AiGradeBatchJobResult> {
  const first = await loadAiGradeBatchForRunner(batchId);
  if (!first || first.status !== "running") return { batchId, status: first?.status ?? "missing" };

  for (let i = first.cursor; i < first.queue.length; i++) {
    const cur = await loadAiGradeBatchForRunner(batchId);
    if (!cur || cur.status !== "running") return { batchId, status: cur?.status ?? "missing" };
    if (cur.stopRequested) {
      await finishAiGradeBatch(batchId, { status: "stopped" });
      return { batchId, status: "stopped" };
    }

    const submissionId = first.queue[i]!;
    // Giảng viên có thể đã chấm tay bài này trong lúc lô chạy — đừng tốn token.
    const sub = await prisma.assignmentSubmission.findUnique({ where: { id: submissionId }, select: { status: true } });
    if (!sub || sub.status === "graded") {
      await recordAiGradeBatchProgress(batchId, { kind: "skipped", submissionId, code: "already_graded" });
      continue;
    }

    try {
      const r = await suggestForSubmission(first.startedById, submissionId);
      if (r.kind === "unreadable") {
        await recordAiGradeBatchProgress(batchId, { kind: "skipped", submissionId, code: "attachment_unreadable" });
        continue;
      }
      const s = r.suggestion;
      await saveAiGradeSuggestion(submissionId, first.assignmentId, batchId, {
        score: s.score,
        feedback: s.feedback,
        rationale: s.rationale,
        // Không chép "evidence" (trích bài nộp) sang bảng gợi ý — chỉ tên tiêu chí và điểm.
        criteria: s.criteria.map((c) => ({ name: c.name, maxPoints: c.maxPoints, points: c.points })),
        hadRubric: r.hadRubric,
        readSources: r.read,
        unread: r.unread,
        truncated: s.truncated ?? null,
        tokensUsed: s.tokensUsed,
        basedOnSubmissionUpdatedAt: r.submissionUpdatedAt,
      });
      await recordAiGradeBatchProgress(batchId, { kind: "done", submissionId, tokens: s.tokensUsed });
    } catch (e) {
      const code = classify(e);
      if (code.halt) {
        await finishAiGradeBatch(batchId, { status: "halted", haltReason: code.code });
        return { batchId, status: "halted" };
      }
      await recordAiGradeBatchProgress(batchId, { kind: code.skip ? "skipped" : "failed", submissionId, code: code.code });
    }
  }

  await finishAiGradeBatch(batchId, { status: "completed" });
  return { batchId, status: "completed" };
}

function classify(e: unknown): { code: string; halt: boolean; skip: boolean } {
  if (e instanceof AiTutorError) return { code: e.code, halt: HALT_CODES.has(e.code), skip: false };
  if (e instanceof AiGenerationError) {
    const details = typeof e.details === "string" ? e.details : "";
    if (details === "empty_submission") return { code: "empty_submission", halt: false, skip: true };
    return { code: e.code, halt: false, skip: false };
  }
  const msg = (e as Error)?.message ?? "";
  // Thiếu khoá AI hoặc mất quyền: mọi bài còn lại cũng sẽ lỗi y hệt — dừng cả lô.
  if (msg === "openai_not_configured") return { code: "openai_not_configured", halt: true, skip: false };
  if ((e as { code?: string })?.code === "forbidden") return { code: "forbidden", halt: true, skip: false };
  return { code: "ai_error", halt: false, skip: false };
}

export async function processAiGradeBatchJob(
  job: Job<AiGradeBatchJobData, AiGradeBatchJobResult>,
): Promise<AiGradeBatchJobResult> {
  try {
    return await runAiGradeBatch(job.data.batchId);
  } catch (err) {
    // Lỗi ngoài dự kiến (DB chập chờn…): để BullMQ retry, chạy tiếp từ cursor. Hết lượt thì đóng lô, nếu không nó
    // ở `running` mãi và chặn việc chạy lô mới.
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await finishAiGradeBatch(job.data.batchId, { status: "halted", haltReason: "internal_error" }).catch(() => {});
    }
    throw err;
  }
}

/**
 * Xếp hàng chạy. Máy dev thường có Redis nhưng không chạy worker, nên ngoài production chạy thẳng trong tiến trình
 * (nền); đặt AI_GRADE_BATCH_MODE=queue để thử hàng đợi thật, =inline để ép chạy trực tiếp. Cùng khuôn với
 * `dispatchClassMail`.
 */
export async function dispatchAiGradeBatch(data: AiGradeBatchJobData): Promise<"queued" | "inline"> {
  const mode = process.env.AI_GRADE_BATCH_MODE;
  const runInline = () => {
    void runAiGradeBatch(data.batchId).catch(async (e) => {
      console.error(`[ai-grade-batch] inline failed (${data.batchId}):`, e);
      await finishAiGradeBatch(data.batchId, { status: "halted", haltReason: "internal_error" }).catch(() => {});
    });
    return "inline" as const;
  };
  if (mode === "inline" || (mode !== "queue" && process.env.NODE_ENV !== "production")) return runInline();
  try {
    await getAiGradeBatchQueue().add("run", data, { jobId: `ai-grade-${data.batchId}` });
    return "queued";
  } catch (err) {
    console.error(`[ai-grade-batch] enqueue failed (${data.batchId}), chạy trực tiếp:`, (err as Error).message);
    return runInline();
  }
}

export const AI_GRADE_BATCH_QUEUE = QUEUE_NAMES.aiGradeBatch;
