import { describe, expect, it } from "vitest";
import { toPublicQuestionConfig } from "../public-config";

describe("toPublicQuestionConfig — không lộ đáp án xuống trình duyệt", () => {
  it("mcq: chỉ còn id + label, không isCorrect / explanation", () => {
    const out = toPublicQuestionConfig("mcq", {
      options: [
        { id: "a", label: "A", isCorrect: true },
        { id: "b", label: "B", isCorrect: false },
      ],
      explanation: "vì A",
    });
    expect(out).toEqual({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    });
    expect(JSON.stringify(out)).not.toMatch(/isCorrect|explanation|vì A/);
  });

  it("multi: cùng quy tắc với mcq", () => {
    const out = toPublicQuestionConfig("multi", {
      options: [{ id: "a", label: "A", isCorrect: true }],
    });
    expect(out).toEqual({ options: [{ id: "a", label: "A" }] });
  });

  it("gap_fill: chỉ còn id của chỗ trống, không acceptedAnswers", () => {
    const out = toPublicQuestionConfig("gap_fill", {
      blanks: [{ id: "b1", acceptedAnswers: ["đáp án"], matchMode: "exact" }],
      explanation: "x",
    });
    expect(out).toEqual({ blanks: [{ id: "b1" }] });
  });

  it("true_false_notgiven / short_answer: config rỗng", () => {
    expect(toPublicQuestionConfig("true_false_notgiven", { correct: "true" })).toEqual({});
    expect(
      toPublicQuestionConfig("short_answer", { acceptedAnswers: ["x"], matchMode: "exact" }),
    ).toEqual({});
  });

  it("essay: giữ minWords, bỏ rubric", () => {
    expect(toPublicQuestionConfig("essay", { rubric: "bí mật", minWords: 100 })).toEqual({
      minWords: 100,
    });
  });

  it("loại lạ hoặc config hỏng: trả rỗng thay vì chuyển nguyên xi", () => {
    expect(toPublicQuestionConfig("matching_heading", { answer: "x" })).toEqual({});
    expect(toPublicQuestionConfig("mcq", null)).toEqual({ options: [] });
    expect(toPublicQuestionConfig("mcq", { options: "oops" })).toEqual({ options: [] });
  });
});
