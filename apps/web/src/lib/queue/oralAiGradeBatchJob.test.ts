import { beforeEach, describe, expect, it, vi } from "vitest";

// Trình chạy lô là phần ĐIỀU PHỐI: test bằng core-lms/AI giả để kiểm luật dừng/lỗi/bỏ qua (AC2, AC6, AC9).
// Phần DB thật (tạo lô, cursor, chốt) đã có test ở packages/core-lms/src/exam/__tests__/oralAiGradeBatch.test.ts.

type Outcome =
  | { kind: "done"; attemptId: string; tokens: number }
  | { kind: "failed" | "skipped"; attemptId: string; code: string };

const state = vi.hoisted(() => ({
  batch: { id: "b1", examId: "e1", startedById: "u1", status: "running", stopRequested: false, queue: [] as string[], cursor: 0 },
  progress: [] as Outcome[],
  finished: [] as { status: string; haltReason?: string }[],
  graded: new Set<string>(),
  generate: vi.fn(),
  onProgress: undefined as undefined | ((o: unknown) => void),
}));

vi.mock("@feedbackme/db", () => ({
  prisma: {
    examAttempt: {
      findUnique: async ({ where }: { where: { id: string } }) => ({ status: state.graded.has(where.id) ? "graded" : "submitted" }),
    },
  },
}));

vi.mock("@feedbackme/core-lms", () => {
  class IntegrationError extends Error {
    constructor(public code: string) {
      super(code);
    }
  }
  return {
    IntegrationError,
    loadOralAiGradeBatchForRunner: async () => ({ ...state.batch, cursor: state.progress.length }),
    recordOralAiGradeBatchProgress: async (_id: string, o: Outcome) => {
      state.progress.push(o);
      state.onProgress?.(o);
    },
    finishOralAiGradeBatch: async (_id: string, o: { status: string; haltReason?: string }) => {
      state.finished.push(o);
      state.batch.status = o.status;
    },
  };
});

vi.mock("@feedbackme/core-feedback", async (orig) => {
  const actual = await orig<typeof import("@feedbackme/core-feedback")>();
  return {
    ...actual,
    generateOralExamEvaluation: (...a: unknown[]) => state.generate(...a),
    openAiChatCompute: () => async () => ({ content: "", inputTokens: 0, outputTokens: 0 }),
  };
});

vi.mock("../openaiClient", () => ({ createOpenaiClient: () => ({}), getChatOnlyApiKey: async () => "k" }));

import { AiTutorError } from "@feedbackme/core-feedback";
import { IntegrationError } from "@feedbackme/core-lms";
import { runOralAiGradeBatch } from "./oralAiGradeBatchJob";

const chat = async () => (async () => ({ content: "", inputTokens: 0, outputTokens: 0 })) as never;
const ok = (score = 80) => ({ aiSuggestedScore: score, aiSummary: "Tóm tắt", tokensUsed: 900 });

beforeEach(() => {
  state.batch = { id: "b1", examId: "e1", startedById: "u1", status: "running", stopRequested: false, queue: ["t1", "t2", "t3"], cursor: 0 };
  state.progress = [];
  state.finished = [];
  state.graded = new Set();
  state.onProgress = undefined;
  state.generate.mockReset();
});

describe("runOralAiGradeBatch", () => {
  it("chạy hết hàng đợi và kết thúc completed, chấm với đúng người bấm nút (ví của họ)", async () => {
    state.generate.mockResolvedValue(ok());
    const r = await runOralAiGradeBatch("b1", chat);
    expect(r.status).toBe("completed");
    expect(state.progress).toEqual([
      { kind: "done", attemptId: "t1", tokens: 900 },
      { kind: "done", attemptId: "t2", tokens: 900 },
      { kind: "done", attemptId: "t3", tokens: 900 },
    ]);
    expect(state.finished).toEqual([{ status: "completed" }]);
    expect(state.generate.mock.calls[0]![0]).toBe("u1");
    expect(state.generate.mock.calls[0]![1]).toBe("t1");
  });

  it("điểm AI không đọc được là lỗi của lượt đó, không phải đề xuất; lô đi tiếp (AC4, AC6)", async () => {
    state.generate.mockResolvedValueOnce(ok()).mockResolvedValueOnce({ aiSuggestedScore: null, aiSummary: "raw", tokensUsed: 500 }).mockResolvedValueOnce(ok());
    const r = await runOralAiGradeBatch("b1", chat);
    expect(r.status).toBe("completed");
    expect(state.progress[1]).toEqual({ kind: "failed", attemptId: "t2", code: "score_unreadable" });
    expect(state.progress[2]).toEqual({ kind: "done", attemptId: "t3", tokens: 900 });
  });

  it("lỗi một lượt không dừng cả lô (AC6)", async () => {
    state.generate.mockResolvedValueOnce(ok()).mockRejectedValueOnce(new AiTutorError("openai_error")).mockResolvedValueOnce(ok());
    expect((await runOralAiGradeBatch("b1", chat)).status).toBe("completed");
    expect(state.progress[1]).toEqual({ kind: "failed", attemptId: "t2", code: "openai_error" });
  });

  it("hết ví dừng sạch cả lô, lượt sau không bị gọi (AC6)", async () => {
    state.generate.mockResolvedValueOnce(ok()).mockRejectedValueOnce(new AiTutorError("no_token_budget"));
    const r = await runOralAiGradeBatch("b1", chat);
    expect(r.status).toBe("halted");
    expect(state.finished).toEqual([{ status: "halted", haltReason: "no_token_budget" }]);
    expect(state.generate).toHaveBeenCalledTimes(2);
  });

  it.each(["global_token_cap", "daily_token_cap", "rate_limited"] as const)("%s cũng dừng cả lô", async (code) => {
    state.generate.mockRejectedValue(new AiTutorError(code));
    expect((await runOralAiGradeBatch("b1", chat)).status).toBe("halted");
    expect(state.finished[0]).toEqual({ status: "halted", haltReason: code });
  });

  it("thiếu khoá AI dừng cả lô, kể cả khi lấy khoá thất bại ngay từ đầu", async () => {
    state.generate.mockRejectedValue(new Error("openai_not_configured"));
    await runOralAiGradeBatch("b1", chat);
    expect(state.finished[0]).toEqual({ status: "halted", haltReason: "openai_not_configured" });

    state.finished = [];
    state.batch.status = "running";
    state.progress = [];
    const r = await runOralAiGradeBatch("b1", async () => {
      throw new IntegrationError("key_not_found" as never);
    });
    expect(r.status).toBe("halted");
    expect(state.finished[0]).toEqual({ status: "halted", haltReason: "openai_not_configured" });
    expect(state.generate).toHaveBeenCalledTimes(1); // lần hai không gọi AI
  });

  it("lượt đã chốt tay trong lúc chạy thì bỏ qua và không tốn token", async () => {
    state.graded.add("t2");
    state.generate.mockResolvedValue(ok());
    await runOralAiGradeBatch("b1", chat);
    expect(state.generate).toHaveBeenCalledTimes(2);
    expect(state.progress[1]).toEqual({ kind: "skipped", attemptId: "t2", code: "already_graded" });
  });

  it("lượt chưa kết thúc hoặc không còn là 'bỏ qua', không phải lỗi hệ thống", async () => {
    state.generate
      .mockRejectedValueOnce(new AiTutorError("validation_failed", "attempt_not_ended"))
      .mockRejectedValueOnce(new AiTutorError("validation_failed", "attempt_not_found"))
      .mockResolvedValueOnce(ok());
    await runOralAiGradeBatch("b1", chat);
    expect(state.progress).toEqual([
      { kind: "skipped", attemptId: "t1", code: "attempt_not_ended" },
      { kind: "skipped", attemptId: "t2", code: "attempt_not_found" },
      { kind: "done", attemptId: "t3", tokens: 900 },
    ]);
  });

  it("yêu cầu dừng: lượt đang chạy xong rồi dừng, lượt chưa chạy giữ nguyên (AC2)", async () => {
    state.generate.mockResolvedValue(ok());
    state.onProgress = () => {
      if (state.progress.length === 1) state.batch.stopRequested = true;
    };
    const r = await runOralAiGradeBatch("b1", chat);
    expect(r.status).toBe("stopped");
    expect(state.generate).toHaveBeenCalledTimes(1);
    expect(state.finished).toEqual([{ status: "stopped" }]);
  });

  it("chạy tiếp từ cursor sau khi retry, không làm lại lượt đã xử lý", async () => {
    state.generate.mockResolvedValue(ok());
    state.progress = [{ kind: "done", attemptId: "t1", tokens: 1 }];
    await runOralAiGradeBatch("b1", chat);
    expect(state.generate.mock.calls.map((c) => c[1])).toEqual(["t2", "t3"]);
  });

  it("lô không còn running thì không làm gì", async () => {
    state.batch.status = "stopped";
    expect((await runOralAiGradeBatch("b1", chat)).status).toBe("stopped");
    expect(state.generate).not.toHaveBeenCalled();
  });
});
