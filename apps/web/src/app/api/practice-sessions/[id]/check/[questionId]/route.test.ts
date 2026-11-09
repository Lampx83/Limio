import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "u1" as string | null }));
vi.mock("@/lib/session", () => ({ requireUserId: async () => state.userId }));

const check = vi.hoisted(() => vi.fn());
const observe = vi.hoisted(() => vi.fn());
const bkt = vi.hoisted(() => vi.fn());
vi.mock("@feedbackme/core-lms", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-lms")>("@feedbackme/core-lms");
  return { ...actual, checkPracticeAnswer: check, observePracticeAnswer: observe };
});
vi.mock("@feedbackme/core-feedback", async () => {
  const actual = await vi.importActual<typeof import("@feedbackme/core-feedback")>("@feedbackme/core-feedback");
  return { ...actual, updateLearnerStateForLessonObservation: bkt };
});

import { ExamError } from "@feedbackme/core-lms";
import { POST } from "./route";

const call = (body?: unknown) =>
  POST(
    new Request("http://localhost:3000/api/practice-sessions/s1/check/q1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: { id: "s1", questionId: "q1" } },
  );

beforeEach(() => {
  state.userId = "u1";
  check.mockReset().mockResolvedValue({ isCorrect: true, score: 1, maxScore: 1, manual: false, config: {} });
  observe.mockReset().mockResolvedValue({ created: true, correct: true });
  bkt.mockReset().mockResolvedValue({ skillsUpdated: 1, newlyMastered: [] });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/practice-sessions/[id]/check/[questionId]", () => {
  it("chưa đăng nhập → 401, không chấm", async () => {
    state.userId = null;
    expect((await call({ lessonId: "l1" })).status).toBe(401);
    expect(check).not.toHaveBeenCalled();
  });

  it("không có thân (luyện đề độc lập): chấm như cũ, KHÔNG ghi nhận kỹ năng", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).isCorrect).toBe(true);
    expect(observe).not.toHaveBeenCalled();
    expect(bkt).not.toHaveBeenCalled();
  });

  it("có lessonId hợp lệ và là lượt mới: gọi BKT với đúng/sai do máy chủ chấm, nguồn 'practice'", async () => {
    observe.mockResolvedValue({ created: true, correct: false });
    check.mockResolvedValue({ isCorrect: false, score: 0, maxScore: 1, manual: false, config: {} });
    const res = await call({ lessonId: "l1", userId: "ke-khac", correct: true });
    expect(res.status).toBe(200);
    expect(observe).toHaveBeenCalledWith("u1", "s1", "q1", "l1");
    expect(bkt).toHaveBeenCalledWith("u1", "l1", false, undefined, "practice");
  });

  it("đã tính rồi hoặc liên kết không hợp lệ (created=false): không gọi BKT nhưng vẫn trả kết quả", async () => {
    observe.mockResolvedValue({ created: false, correct: null });
    const res = await call({ lessonId: "l1" });
    expect(res.status).toBe(200);
    expect(bkt).not.toHaveBeenCalled();
  });

  it("câu tự luận (manual) hoặc chưa có đúng/sai: không ghi nhận", async () => {
    check.mockResolvedValue({ isCorrect: null, score: null, maxScore: 5, manual: true, config: {} });
    await call({ lessonId: "l1" });
    expect(observe).not.toHaveBeenCalled();
  });

  it("lessonId sai kiểu, rỗng hoặc quá dài bị bỏ qua", async () => {
    for (const lessonId of [5, "", "x".repeat(101), null, { a: 1 }]) await call({ lessonId });
    expect(observe).not.toHaveBeenCalled();
  });

  it("lỗi ở cầu nối (ghi nhận hoặc BKT) KHÔNG làm hỏng việc kiểm tra", async () => {
    observe.mockRejectedValueOnce(new Error("db down"));
    expect((await call({ lessonId: "l1" })).status).toBe(200);
    bkt.mockRejectedValueOnce(new Error("bkt down"));
    const res = await call({ lessonId: "l1" });
    expect(res.status).toBe(200);
    expect((await res.json()).isCorrect).toBe(true);
  });

  it("lỗi của luyện đề (vd chưa trả lời) vẫn ánh xạ đúng, không ghi nhận gì", async () => {
    check.mockRejectedValueOnce(new ExamError("practice_not_answered"));
    const res = await call({ lessonId: "l1" });
    expect(res.status).toBe(409);
    expect(observe).not.toHaveBeenCalled();
  });
});
