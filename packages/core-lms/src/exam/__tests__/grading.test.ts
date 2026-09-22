import { describe, expect, it } from "vitest";
import { gradeExamAnswer } from "../grading";

describe("gradeExamAnswer", () => {
  it("MCQ — full points only when exactly the correct option", () => {
    const cfg = {
      options: [
        { id: "a", isCorrect: true },
        { id: "b", isCorrect: false },
        { id: "c", isCorrect: false },
      ],
    };
    expect(gradeExamAnswer("mcq", cfg, { optionIds: ["a"] }, 5)).toEqual({
      autoScore: 5,
      needsGrading: false,
    });
    expect(gradeExamAnswer("mcq", cfg, { optionIds: ["b"] }, 5)).toEqual({
      autoScore: 0,
      needsGrading: false,
    });
    expect(gradeExamAnswer("mcq", cfg, { optionIds: [] }, 5)).toEqual({
      autoScore: 0,
      needsGrading: false,
    });
    // Two selections on MCQ → zero (P0 no partial credit).
    expect(gradeExamAnswer("mcq", cfg, { optionIds: ["a", "b"] }, 5)).toEqual({
      autoScore: 0,
      needsGrading: false,
    });
  });

  it("MULTI — set equality required for full points", () => {
    const cfg = {
      options: [
        { id: "a", isCorrect: true },
        { id: "b", isCorrect: true },
        { id: "c", isCorrect: false },
      ],
    };
    expect(gradeExamAnswer("multi", cfg, { optionIds: ["a", "b"] }, 4)).toEqual({
      autoScore: 4,
      needsGrading: false,
    });
    expect(gradeExamAnswer("multi", cfg, { optionIds: ["a"] }, 4)).toEqual({
      autoScore: 0,
      needsGrading: false,
    });
    expect(gradeExamAnswer("multi", cfg, { optionIds: ["a", "b", "c"] }, 4)).toEqual({
      autoScore: 0,
      needsGrading: false,
    });
  });

  it("TRUE_FALSE_NOTGIVEN — exact match", () => {
    const cfg = { correct: "notgiven" };
    expect(gradeExamAnswer("true_false_notgiven", cfg, { correct: "notgiven" }, 2)).toEqual({
      autoScore: 2,
      needsGrading: false,
    });
    expect(gradeExamAnswer("true_false_notgiven", cfg, { correct: "true" }, 2)).toEqual({
      autoScore: 0,
      needsGrading: false,
    });
  });

  it("GAP_FILL — every blank must match (case_insensitive default)", () => {
    const cfg = {
      blanks: [
        { id: "b1", acceptedAnswers: ["Paris"], matchMode: "case_insensitive" as const },
        { id: "b2", acceptedAnswers: ["Tokyo"], matchMode: "case_insensitive" as const },
      ],
    };
    expect(
      gradeExamAnswer("gap_fill", cfg, { blanks: { b1: "paris", b2: "TOKYO" } }, 6),
    ).toEqual({ autoScore: 6, needsGrading: false });
    expect(
      gradeExamAnswer("gap_fill", cfg, { blanks: { b1: "paris", b2: "kyoto" } }, 6),
    ).toEqual({ autoScore: 0, needsGrading: false });
    expect(
      gradeExamAnswer("gap_fill", cfg, { blanks: { b1: "paris" } }, 6),
    ).toEqual({ autoScore: 0, needsGrading: false });
  });

  it("GAP_FILL exact mode is case-sensitive", () => {
    const cfg = {
      blanks: [
        { id: "b1", acceptedAnswers: ["Paris"], matchMode: "exact" as const },
      ],
    };
    expect(
      gradeExamAnswer("gap_fill", cfg, { blanks: { b1: "paris" } }, 3),
    ).toEqual({ autoScore: 0, needsGrading: false });
    expect(
      gradeExamAnswer("gap_fill", cfg, { blanks: { b1: "Paris" } }, 3),
    ).toEqual({ autoScore: 3, needsGrading: false });
  });

  it("ESSAY / SHORT — defer to manual grading", () => {
    expect(gradeExamAnswer("essay", { rubric: "x" }, { text: "long text" }, 10)).toEqual({
      autoScore: null,
      needsGrading: true,
    });
    expect(gradeExamAnswer("short_answer", { acceptedAnswers: ["x"] }, { text: "x" }, 2)).toEqual({
      autoScore: null,
      needsGrading: true,
    });
  });

  // Đợt 1 (thống nhất nhập câu hỏi Quiz/Bank/Exam) — 4 loại mới, tự chấm được,
  // theo đúng cấu trúc config đã chốt ở schemas.ts (OrderingConfig,
  // MatchingConfig, NumericalConfig, DragDropFillConfig).

  describe("ORDERING — sắp xếp đúng thứ tự", () => {
    const cfg = {
      items: [
        { id: "s1", label: "Bước 1" },
        { id: "s2", label: "Bước 2" },
        { id: "s3", label: "Bước 3" },
      ],
    };
    it("đúng thứ tự y hệt items", () => {
      expect(gradeExamAnswer("ordering", cfg, { order: ["s1", "s2", "s3"] }, 6)).toEqual({
        autoScore: 6,
        needsGrading: false,
      });
    });
    it("sai thứ tự: 0 điểm, không có điểm từng phần", () => {
      expect(gradeExamAnswer("ordering", cfg, { order: ["s2", "s1", "s3"] }, 6)).toEqual({
        autoScore: 0,
        needsGrading: false,
      });
    });
    it("thiếu bước: 0 điểm", () => {
      expect(gradeExamAnswer("ordering", cfg, { order: ["s1", "s2"] }, 6)).toEqual({
        autoScore: 0,
        needsGrading: false,
      });
    });
  });

  describe("MATCHING — ghép đôi", () => {
    const cfg = {
      pairs: [
        { id: "p1", left: "Hà Nội", right: "Việt Nam" },
        { id: "p2", left: "Bangkok", right: "Thái Lan" },
      ],
    };
    it("ghép đúng mọi cặp", () => {
      expect(
        gradeExamAnswer("matching", cfg, { matched: { p1: "p1", p2: "p2" } }, 4),
      ).toEqual({ autoScore: 4, needsGrading: false });
    });
    it("ghép chéo (sai 1 cặp): 0 điểm, all-or-nothing", () => {
      expect(
        gradeExamAnswer("matching", cfg, { matched: { p1: "p2", p2: "p1" } }, 4),
      ).toEqual({ autoScore: 0, needsGrading: false });
    });
    it("thiếu một cặp chưa ghép: 0 điểm", () => {
      expect(gradeExamAnswer("matching", cfg, { matched: { p1: "p1" } }, 4)).toEqual({
        autoScore: 0,
        needsGrading: false,
      });
    });
  });

  describe("NUMERICAL — số học, chấp nhận sai số", () => {
    const cfg = { expected: 3.14, tolerance: 0.01 };
    it("đúng tuyệt đối", () => {
      expect(gradeExamAnswer("numerical", cfg, { value: 3.14 }, 5)).toEqual({
        autoScore: 5,
        needsGrading: false,
      });
    });
    it("trong sai số cho phép", () => {
      expect(gradeExamAnswer("numerical", cfg, { value: 3.145 }, 5)).toEqual({
        autoScore: 5,
        needsGrading: false,
      });
    });
    it("ngoài sai số cho phép", () => {
      expect(gradeExamAnswer("numerical", cfg, { value: 3.2 }, 5)).toEqual({
        autoScore: 0,
        needsGrading: false,
      });
    });
    it("nộp chuỗi số hợp lệ (không phải number): vẫn chấm được", () => {
      expect(gradeExamAnswer("numerical", cfg, { value: "3.14" }, 5)).toEqual({
        autoScore: 5,
        needsGrading: false,
      });
    });
    it("nộp không phải số: 0 điểm, không crash", () => {
      expect(gradeExamAnswer("numerical", cfg, { value: "không biết" }, 5)).toEqual({
        autoScore: 0,
        needsGrading: false,
      });
    });
    it("thiếu tolerance trong config (dữ liệu cũ): coi như 0", () => {
      expect(
        gradeExamAnswer("numerical", { expected: 10 }, { value: 10 }, 5),
      ).toEqual({ autoScore: 5, needsGrading: false });
    });
  });

  describe("DRAG_DROP_FILL — kéo thả điền từ, all-or-nothing", () => {
    const cfg = {
      tokens: [
        { id: "t1", label: "Hà Nội", blankIndex: 1 },
        { id: "t2", label: "sông Hồng", blankIndex: 2 },
        { id: "t3", label: "Paris", blankIndex: null }, // mồi nhử
      ],
    };
    it("điền đúng mọi chỗ trống", () => {
      expect(
        gradeExamAnswer("drag_drop_fill", cfg, { placed: { "1": "t1", "2": "t2" } }, 4),
      ).toEqual({ autoScore: 4, needsGrading: false });
    });
    it("điền nhầm mồi nhử vào chỗ trống: 0 điểm", () => {
      expect(
        gradeExamAnswer("drag_drop_fill", cfg, { placed: { "1": "t3", "2": "t2" } }, 4),
      ).toEqual({ autoScore: 0, needsGrading: false });
    });
    it("thiếu 1 chỗ trống chưa điền: 0 điểm", () => {
      expect(
        gradeExamAnswer("drag_drop_fill", cfg, { placed: { "1": "t1" } }, 4),
      ).toEqual({ autoScore: 0, needsGrading: false });
    });
    it("config hỏng (không có token nào là chỗ trống thật): 0 điểm, không crash", () => {
      expect(
        gradeExamAnswer("drag_drop_fill", { tokens: [{ id: "t1", label: "x", blankIndex: null }] }, { placed: {} }, 4),
      ).toEqual({ autoScore: 0, needsGrading: false });
    });
  });
});
