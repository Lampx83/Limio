import { describe, expect, it } from "vitest";
import { resolveQuizScore } from "../scoring";

const d = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
const attempts = [
  { scorePct: 80, submittedAt: d(1) },
  { scorePct: 50, submittedAt: d(3) },
  { scorePct: 90, submittedAt: d(2) },
];

describe("resolveQuizScore", () => {
  it("highest lấy điểm cao nhất", () => expect(resolveQuizScore(attempts, "highest")).toBe(90));
  it("latest lấy lượt nộp muộn nhất, không phải phần tử cuối mảng", () =>
    expect(resolveQuizScore(attempts, "latest")).toBe(50));
  it("average lấy trung bình", () => expect(resolveQuizScore(attempts, "average")).toBeCloseTo(73.33, 1));
  it("bỏ qua lượt chưa có điểm; không có lượt nào thì null", () => {
    expect(resolveQuizScore([{ scorePct: null, submittedAt: d(1) }, ...attempts], "highest")).toBe(90);
    expect(resolveQuizScore([], "average")).toBeNull();
  });
});
