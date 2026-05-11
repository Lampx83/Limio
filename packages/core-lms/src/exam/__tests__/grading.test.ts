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
});
