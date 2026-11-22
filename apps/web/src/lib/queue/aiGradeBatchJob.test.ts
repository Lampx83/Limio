import { beforeEach, describe, expect, it, vi } from "vitest";

// Trình chạy lô là phần ĐIỀU PHỐI: test bằng core-lms/AI giả để kiểm luật dừng/lỗi/bỏ qua (AC2, AC6, AC8).
// Phần DB thật (tạo lô, cursor, chốt) đã có test ở packages/core-lms/src/courses/__tests__/aiGradeBatch.test.ts.

type Outcome =
  | { kind: "done"; submissionId: string; tokens: number }
  | { kind: "failed" | "skipped"; submissionId: string; code: string };

const state = vi.hoisted(() => ({
  batch: { id: "b1", assignmentId: "a1", startedById: "u1", status: "running", stopRequested: false, queue: [] as string[], cursor: 0 },
  progress: [] as unknown[],
  saved: [] as { submissionId: string; criteria: unknown }[],
  finished: [] as { status: string; haltReason?: string }[],
  graded: new Set<string>(),
  suggest: vi.fn(),
  onProgress: undefined as undefined | ((o: unknown) => void),
}));

vi.mock("@feedbackme/db", () => ({
  prisma: {
    assignmentSubmission: {
      findUnique: async ({ where }: { where: { id: string } }) => ({ status: state.graded.has(where.id) ? "graded" : "submitted" }),
    },
  },
}));

vi.mock("@feedbackme/core-lms", () => ({
  loadAiGradeBatchForRunner: async () => ({ ...state.batch, cursor: state.progress.length }),
  recordAiGradeBatchProgress: async (_id: string, o: Outcome) => {
    state.progress.push(o);
    state.onProgress?.(o);
  },
  saveAiGradeSuggestion: async (submissionId: string, _a: string, _b: string, s: { criteria: unknown }) => {
    state.saved.push({ submissionId, criteria: s.criteria });
  },
  finishAiGradeBatch: async (_id: string, o: { status: string; haltReason?: string }) => {
    state.finished.push(o);
    state.batch.status = o.status;
  },
}));

vi.mock("../assignmentAiSuggest", () => ({ suggestForSubmission: (...a: unknown[]) => state.suggest(...a) }));

import { AiGenerationError, AiTutorError } from "@feedbackme/core-feedback";
import { runAiGradeBatch } from "./aiGradeBatchJob";

const ok = (score = 7) => ({
  kind: "ok" as const,
  suggestion: {
    score,
    feedback: "Nhận xét",
    rationale: "Lý do",
    criteria: [{ name: "Nội dung", maxPoints: 10, points: score, evidence: "TRÍCH BÀI NỘP BÍ MẬT" }],
    tokensUsed: 900,
  },
  hadRubric: true,
  read: [],
  unread: null,
  submissionUpdatedAt: new Date("2026-11-22T00:00:00Z"),
});

beforeEach(() => {
  state.batch = { id: "b1", assignmentId: "a1", startedById: "u1", status: "running", stopRequested: false, queue: ["s1", "s2", "s3"], cursor: 0 };
  state.progress = [];
  state.saved = [];
  state.finished = [];
  state.graded = new Set();
  state.onProgress = undefined;
  state.suggest.mockReset();
});

describe("runAiGradeBatch", () => {
  it("chạy hết hàng đợi, lưu gợi ý và kết thúc completed", async () => {
    state.suggest.mockResolvedValue(ok());
    const r = await runAiGradeBatch("b1");
    expect(r.status).toBe("completed");
    expect(state.saved.map((s) => s.submissionId)).toEqual(["s1", "s2", "s3"]);
    expect(state.progress).toHaveLength(3);
    expect(state.finished).toEqual([{ status: "completed" }]);
    // Chấm với đúng người bấm nút (ví của họ).
    expect(state.suggest).toHaveBeenCalledWith("u1", "s1");
  });

  it("không chép bằng chứng (trích bài nộp) sang bảng gợi ý", async () => {
    state.suggest.mockResolvedValue(ok());
    await runAiGradeBatch("b1");
    expect(JSON.stringify(state.saved)).not.toContain("BÍ MẬT");
  });

  it("lỗi một bài không dừng cả lô (AC6)", async () => {
    state.suggest
      .mockResolvedValueOnce(ok())
      .mockRejectedValueOnce(new AiGenerationError("validation_failed", "bad_json"))
      .mockResolvedValueOnce(ok());
    const r = await runAiGradeBatch("b1");
    expect(r.status).toBe("completed");
    expect(state.progress).toEqual([
      { kind: "done", submissionId: "s1", tokens: 900 },
      { kind: "failed", submissionId: "s2", code: "validation_failed" },
      { kind: "done", submissionId: "s3", tokens: 900 },
    ]);
  });

  it("hết ví dừng sạch cả lô, giữ gợi ý đã có (AC6)", async () => {
    state.suggest.mockResolvedValueOnce(ok()).mockRejectedValueOnce(new AiTutorError("no_token_budget"));
    const r = await runAiGradeBatch("b1");
    expect(r.status).toBe("halted");
    expect(state.saved.map((s) => s.submissionId)).toEqual(["s1"]);
    expect(state.finished).toEqual([{ status: "halted", haltReason: "no_token_budget" }]);
    expect(state.suggest).toHaveBeenCalledTimes(2); // s3 không bị gọi
  });

  it.each(["global_token_cap", "daily_token_cap", "rate_limited"] as const)("%s cũng dừng cả lô", async (code) => {
    state.suggest.mockRejectedValue(new AiTutorError(code));
    expect((await runAiGradeBatch("b1")).status).toBe("halted");
    expect(state.finished[0]).toEqual({ status: "halted", haltReason: code });
  });

  it("thiếu khoá AI dừng cả lô", async () => {
    state.suggest.mockRejectedValue(new Error("openai_not_configured"));
    await runAiGradeBatch("b1");
    expect(state.finished[0]).toEqual({ status: "halted", haltReason: "openai_not_configured" });
  });

  it("tệp không đọc được và bài trống là 'bỏ qua', không phải lỗi hệ thống", async () => {
    state.suggest
      .mockResolvedValueOnce({ kind: "unreadable", details: { what: "ảnh", why: "x" } })
      .mockRejectedValueOnce(new AiGenerationError("validation_failed", "empty_submission"))
      .mockResolvedValueOnce(ok());
    await runAiGradeBatch("b1");
    expect(state.progress).toEqual([
      { kind: "skipped", submissionId: "s1", code: "attachment_unreadable" },
      { kind: "skipped", submissionId: "s2", code: "empty_submission" },
      { kind: "done", submissionId: "s3", tokens: 900 },
    ]);
  });

  it("bài đã được chấm tay trong lúc chạy thì bỏ qua và không tốn token", async () => {
    state.graded.add("s2");
    state.suggest.mockResolvedValue(ok());
    await runAiGradeBatch("b1");
    expect(state.suggest).toHaveBeenCalledTimes(2);
    expect(state.progress[1]).toEqual({ kind: "skipped", submissionId: "s2", code: "already_graded" });
  });

  it("yêu cầu dừng: bài đang chạy xong rồi dừng, bài chưa chạy giữ nguyên (AC2)", async () => {
    state.suggest.mockResolvedValue(ok());
    state.onProgress = () => {
      if (state.progress.length === 1) state.batch.stopRequested = true;
    };
    const r = await runAiGradeBatch("b1");
    expect(r.status).toBe("stopped");
    expect(state.saved.map((s) => s.submissionId)).toEqual(["s1"]);
    expect(state.finished).toEqual([{ status: "stopped" }]);
  });

  it("chạy tiếp từ cursor sau khi retry, không làm lại bài đã xử lý", async () => {
    state.suggest.mockResolvedValue(ok());
    state.progress = [{ kind: "done", submissionId: "s1", tokens: 1 }, { kind: "done", submissionId: "s2", tokens: 1 }];
    await runAiGradeBatch("b1");
    expect(state.suggest).toHaveBeenCalledTimes(1);
    expect(state.suggest).toHaveBeenCalledWith("u1", "s3");
  });

  it("lô không còn running thì không làm gì", async () => {
    state.batch.status = "stopped";
    const r = await runAiGradeBatch("b1");
    expect(r.status).toBe("stopped");
    expect(state.suggest).not.toHaveBeenCalled();
  });
});
