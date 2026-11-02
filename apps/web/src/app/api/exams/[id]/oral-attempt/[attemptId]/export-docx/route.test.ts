import { beforeEach, describe, expect, it, vi } from "vitest";

const attemptFindUnique = vi.fn();
vi.mock("@feedbackme/db", () => ({
  prisma: { examAttempt: { findUnique: attemptFindUnique } },
}));
const getOralEvaluation = vi.fn();
class CourseAuthzError extends Error {}
class ExamError extends Error {}
vi.mock("@feedbackme/core-lms", () => ({ getOralEvaluation, CourseAuthzError, ExamError }));
const requireUserId = vi.fn();
vi.mock("@/lib/session", () => ({ requireUserId }));

const { GET } = await import("./route");

const params = { id: "de-1", attemptId: "luot-1" };
const call = () => GET(new Request("http://test/api"), { params });

describe("GET /api/exams/[id]/oral-attempt/[attemptId]/export-docx", () => {
  beforeEach(() => {
    requireUserId.mockReset().mockResolvedValue("gv-1");
    getOralEvaluation.mockReset().mockResolvedValue({
      evaluation: null,
      turns: [{ role: "examiner", content: "Câu hỏi" }],
    });
    attemptFindUnique.mockReset().mockResolvedValue({
      startedAt: new Date("2026-11-02T02:00:00Z"),
      submittedAt: new Date("2026-11-02T02:30:00Z"),
      user: { displayName: "Nguyễn Văn An", email: "an@example.com" },
      exam: { id: "de-1", title: "Giữa kỳ", courseId: null, course: null },
    });
  });

  it("trả file Word đặt tên theo học viên, ngày thi, tên đề", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("wordprocessingml");
    expect(res.headers.get("content-disposition")).toContain(
      encodeURIComponent("Nguyễn Văn An - 02-11-2026 - Giữa kỳ.docx"),
    );
  });

  it("không xuất lượt thi của đề khác", async () => {
    attemptFindUnique.mockResolvedValue({
      startedAt: new Date(),
      submittedAt: null,
      user: null,
      exam: { id: "de-khac", title: "Khác", courseId: null, course: null },
    });
    expect((await call()).status).toBe(404);
  });

  it("từ chối khi chưa đăng nhập hoặc không có quyền", async () => {
    requireUserId.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(401);
    getOralEvaluation.mockRejectedValueOnce(new CourseAuthzError("no"));
    expect((await call()).status).toBe(403);
  });
});
