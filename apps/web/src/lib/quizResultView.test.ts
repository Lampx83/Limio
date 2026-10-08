import { describe, expect, it } from "vitest";
import { formatPoints, summarizeScore, xpMultiplierNote } from "./quizResultView";

describe("formatPoints", () => {
  it("bỏ phần thập phân thừa và dùng dấu phẩy", () => {
    expect(formatPoints(14)).toBe("14");
    expect(formatPoints(12.5)).toBe("12,5");
    expect(formatPoints(7.04)).toBe("7");
  });
});

describe("summarizeScore", () => {
  it("giải thích khi % điểm lệch tỷ lệ số câu đúng (7/12 câu nhưng 60%)", () => {
    const s = summarizeScore({ scorePct: 60, totalPoints: 20, correctCount: 7, totalQuestions: 12 });
    expect(s?.earnedPoints).toBe(12);
    expect(s?.totalPoints).toBe(20);
    expect(s?.note).toContain("tính theo điểm của từng câu");
  });
  it("không nhắc gì khi hai tỷ lệ khớp nhau", () => {
    const s = summarizeScore({ scorePct: 50, totalPoints: 10, correctCount: 5, totalQuestions: 10 });
    expect(s?.note).toBeNull();
    expect(s?.earnedPoints).toBe(5);
  });
  it("không có điểm hoặc đề rỗng thì không hiện gì", () => {
    expect(summarizeScore({ scorePct: null, totalPoints: 10, correctCount: 0, totalQuestions: 5 })).toBeNull();
    expect(summarizeScore({ scorePct: 0, totalPoints: 0, correctCount: 0, totalQuestions: 0 })).toBeNull();
  });
  it("điểm tay của giảng viên vẫn đúng vì suy từ phần trăm đã lưu", () => {
    const s = summarizeScore({ scorePct: 37.5, totalPoints: 8, correctCount: 1, totalQuestions: 4 });
    expect(s?.earnedPoints).toBe(3);
  });
});

describe("xpMultiplierNote", () => {
  it("hệ số 1 hoặc không có thì im lặng", () => {
    expect(xpMultiplierNote(undefined)).toBeNull();
    expect(xpMultiplierNote(1)).toBeNull();
  });
  it("hệ số nhỏ hơn 1 nói vì sao bị giảm, không dùng từ 'master'", () => {
    const n = xpMultiplierNote(0.5);
    expect(n).toContain("×0.5");
    expect(n).toContain("đã vững");
    expect(n).not.toContain("master");
  });
  it("hệ số lớn hơn 1 nói vì sao được thêm", () => {
    expect(xpMultiplierNote(1.5)).toContain("còn khó với bạn");
  });
});
