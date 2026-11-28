import type { Job } from "bullmq";
import { prisma } from "@feedbackme/db";
import {
  finishOralAiGradeBatch,
  IntegrationError,
  loadOralAiGradeBatchForRunner,
  recordOralAiGradeBatchProgress,
} from "@feedbackme/core-lms";
import { AiTutorError, generateOralExamEvaluation, openAiChatCompute } from "@feedbackme/core-feedback";
import { createOpenaiClient, getChatOnlyApiKey } from "../openaiClient";
import { getOralAiGradeBatchQueue, QUEUE_NAMES } from "./index";

/**
 * Chấm vấn đáp bằng AI hàng loạt (docs/tieu-chi/cham-van-dap-bang-ai-hang-loat.md, AC2/AC6).
 *
 * Chạy TUẦN TỰ từng lượt trong hàng đợi của lô, mỗi lượt qua đúng `generateOralExamEvaluation` (cùng đường chấm
 * với nút "Chấm bằng AI" của từng lượt). Chỉ lưu đề xuất; không bao giờ ghi điểm chốt. Tiến độ nằm trong DB nên job
 * chạy tiếp được sau retry (cursor = số lượt đã xử lý) và giao diện đọc được dù đóng trang.
 */
export type OralAiGradeBatchJobData = { batchId: string };
export type OralAiGradeBatchJobResult = { batchId: string; status: string };

/** Hết ví hoặc chạm trần: dừng sạch cả lô, giữ đề xuất đã có, để giảng viên chạy tiếp sau khi nạp. */
const HALT_CODES = new Set(["no_token_budget", "global_token_cap", "daily_token_cap", "rate_limited"]);

type ChatFn = ReturnType<typeof openAiChatCompute>;

export async function runOralAiGradeBatch(
  batchId: string,
  // Tiêm được để test không cần khoá AI thật.
  getChat: () => Promise<ChatFn> = defaultChat,
): Promise<OralAiGradeBatchJobResult> {
  const first = await loadOralAiGradeBatchForRunner(batchId);
  if (!first || first.status !== "running") return { batchId, status: first?.status ?? "missing" };

  let chat: ChatFn;
  try {
    chat = await getChat();
  } catch (e) {
    // Thiếu khoá AI: mọi lượt còn lại cũng lỗi y hệt — dừng cả lô.
    if (isKeyMissing(e)) {
      await finishOralAiGradeBatch(batchId, { status: "halted", haltReason: "openai_not_configured" });
      return { batchId, status: "halted" };
    }
    throw e;
  }

  for (let i = first.cursor; i < first.queue.length; i++) {
    const cur = await loadOralAiGradeBatchForRunner(batchId);
    if (!cur || cur.status !== "running") return { batchId, status: cur?.status ?? "missing" };
    if (cur.stopRequested) {
      await finishOralAiGradeBatch(batchId, { status: "stopped" });
      return { batchId, status: "stopped" };
    }

    const attemptId = first.queue[i]!;
    // Giảng viên có thể đã chốt tay lượt này trong lúc lô chạy — đừng tốn token.
    const att = await prisma.examAttempt.findUnique({ where: { id: attemptId }, select: { status: true } });
    if (!att || att.status === "graded") {
      await recordOralAiGradeBatchProgress(batchId, { kind: "skipped", attemptId, code: "already_graded" });
      continue;
    }

    try {
      const r = await generateOralExamEvaluation(first.startedById, attemptId, chat);
      if (r.aiSuggestedScore == null) {
        // AI trả sai khuôn nên không có điểm đọc được: không phải đề xuất — để giảng viên chạy lại.
        await recordOralAiGradeBatchProgress(batchId, { kind: "failed", attemptId, code: "score_unreadable" });
        continue;
      }
      await recordOralAiGradeBatchProgress(batchId, { kind: "done", attemptId, tokens: r.tokensUsed });
    } catch (e) {
      const c = classify(e);
      if (c.halt) {
        await finishOralAiGradeBatch(batchId, { status: "halted", haltReason: c.code });
        return { batchId, status: "halted" };
      }
      await recordOralAiGradeBatchProgress(batchId, { kind: c.skip ? "skipped" : "failed", attemptId, code: c.code });
    }
  }

  await finishOralAiGradeBatch(batchId, { status: "completed" });
  return { batchId, status: "completed" };
}

async function defaultChat(): Promise<ChatFn> {
  return openAiChatCompute(createOpenaiClient(await getChatOnlyApiKey()));
}

function isKeyMissing(e: unknown): boolean {
  return (e instanceof IntegrationError && e.code === "key_not_found") || (e as Error)?.message === "openai_not_configured";
}

export function classify(e: unknown): { code: string; halt: boolean; skip: boolean } {
  if (e instanceof AiTutorError) {
    const details = typeof e.details === "string" ? e.details : "";
    // Lượt đã đổi trạng thái giữa chừng (bị xoá, chưa kết thúc): không phải lỗi của AI.
    if (e.code === "validation_failed" && (details === "attempt_not_found" || details === "attempt_not_ended")) {
      return { code: details, halt: false, skip: true };
    }
    return { code: e.code, halt: HALT_CODES.has(e.code), skip: false };
  }
  if (isKeyMissing(e)) return { code: "openai_not_configured", halt: true, skip: false };
  if ((e as { code?: string })?.code === "forbidden") return { code: "forbidden", halt: true, skip: false };
  return { code: "ai_error", halt: false, skip: false };
}

export async function processOralAiGradeBatchJob(
  job: Job<OralAiGradeBatchJobData, OralAiGradeBatchJobResult>,
): Promise<OralAiGradeBatchJobResult> {
  try {
    return await runOralAiGradeBatch(job.data.batchId);
  } catch (err) {
    // Lỗi ngoài dự kiến (DB chập chờn…): để BullMQ retry, chạy tiếp từ cursor. Hết lượt thì đóng lô, nếu không nó
    // ở `running` mãi và chặn việc chạy lô mới.
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await finishOralAiGradeBatch(job.data.batchId, { status: "halted", haltReason: "internal_error" }).catch(() => {});
    }
    throw err;
  }
}

/**
 * Xếp hàng chạy. Máy dev thường có Redis nhưng không chạy worker, nên ngoài production chạy thẳng trong tiến trình
 * (nền); đặt AI_GRADE_BATCH_MODE=queue để thử hàng đợi thật, =inline để ép chạy trực tiếp (cùng biến với lô bài tập).
 */
export async function dispatchOralAiGradeBatch(data: OralAiGradeBatchJobData): Promise<"queued" | "inline"> {
  const mode = process.env.AI_GRADE_BATCH_MODE;
  const runInline = () => {
    void runOralAiGradeBatch(data.batchId).catch(async (e) => {
      console.error(`[oral-ai-grade-batch] inline failed (${data.batchId}):`, e);
      await finishOralAiGradeBatch(data.batchId, { status: "halted", haltReason: "internal_error" }).catch(() => {});
    });
    return "inline" as const;
  };
  if (mode === "inline" || (mode !== "queue" && process.env.NODE_ENV !== "production")) return runInline();
  try {
    await getOralAiGradeBatchQueue().add("run", data, { jobId: `oral-ai-grade-${data.batchId}` });
    return "queued";
  } catch (err) {
    console.error(`[oral-ai-grade-batch] enqueue failed (${data.batchId}), chạy trực tiếp:`, (err as Error).message);
    return runInline();
  }
}

export const ORAL_AI_GRADE_BATCH_QUEUE = QUEUE_NAMES.oralAiGradeBatch;
