import { describe, expect, it } from "vitest";
import { computeAssessmentSteps } from "./assessmentSteps";

describe("computeAssessmentSteps", () => {
  it("chưa có gì: bước đầu là việc tiếp theo, hai bước sau chưa mở", () => {
    const r = computeAssessmentSteps({ publishedQuestions: 0, publishedExams: 0, draftExams: 0, sessions: 0 });
    expect(r.next).toBe("bank");
    expect(r.steps.map((s) => s.status)).toEqual(["current", "waiting", "waiting"]);
  });

  it("có câu hỏi published, chưa có đề: bước 2", () => {
    const r = computeAssessmentSteps({ publishedQuestions: 12, publishedExams: 0, draftExams: 0, sessions: 0 });
    expect(r.next).toBe("exam");
    expect(r.steps.map((s) => s.status)).toEqual(["done", "current", "waiting"]);
  });

  it("có đề nháp nhưng chưa publish: vẫn ở bước 2 và nhắc publish", () => {
    const r = computeAssessmentSteps({ publishedQuestions: 12, publishedExams: 0, draftExams: 2, sessions: 0 });
    expect(r.next).toBe("exam");
    expect(r.steps[1]!.hint).toMatch(/publish/i);
  });

  it("có đề published, chưa tổ chức buổi nào: bước 3", () => {
    const r = computeAssessmentSteps({ publishedQuestions: 12, publishedExams: 1, draftExams: 0, sessions: 0 });
    expect(r.next).toBe("organize");
    expect(r.steps.map((s) => s.status)).toEqual(["done", "done", "current"]);
  });

  it("đủ cả ba: không còn bước tiếp theo bắt buộc", () => {
    const r = computeAssessmentSteps({ publishedQuestions: 12, publishedExams: 1, draftExams: 0, sessions: 3 });
    expect(r.next).toBe("done");
    expect(r.steps.every((s) => s.status === "done")).toBe(true);
  });

  it("đề đã tự soạn (không dùng ngân hàng) vẫn cho đi tiếp: bước 1 không chặn bước 2", () => {
    const r = computeAssessmentSteps({ publishedQuestions: 0, publishedExams: 1, draftExams: 0, sessions: 0 });
    expect(r.next).toBe("organize");
    expect(r.steps[0]!.status).toBe("skipped");
  });
});
