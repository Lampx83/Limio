import { describe, expect, it } from "vitest";
import { answerKeyText } from "../answerKey";

describe("answerKeyText (đáp án hiện lên màn chiếu lớp)", () => {
  it("mcq/multi: chỉ lấy các lựa chọn đúng", () => {
    const config = { options: [{ label: "A", isCorrect: false }, { label: "钥匙", isCorrect: true }, { label: "C", isCorrect: true }], explanation: "Vì sao" };
    const k = answerKeyText("multi", config);
    expect(k.lines).toEqual(["钥匙", "C"]);
    expect(k.explanation).toBe("Vì sao");
    expect(k.open).toBe(false);
  });

  it("gap_fill: một chỗ trống thì không đánh số, nhiều chỗ thì đánh số và nối đáp án thay thế", () => {
    expect(answerKeyText("gap_fill", { blanks: [{ acceptedAnswers: ["满"] }] }).lines).toEqual(["满"]);
    expect(answerKeyText("gap_fill", { blanks: [{ acceptedAnswers: ["看"] }, { acceptedAnswers: ["瞧", "看"] }] }).lines).toEqual(["1. 看", "2. 瞧 / 看"]);
  });

  it("short_answer, numerical, ordering, matching, drag_drop_fill", () => {
    expect(answerKeyText("short_answer", { acceptedAnswers: ["钥匙"] }).lines).toEqual(["钥匙"]);
    expect(answerKeyText("numerical", { expected: 10 }).lines).toEqual(["10"]);
    expect(answerKeyText("ordering", { items: [{ label: "他们" }, { label: "赶紧" }] }).lines).toEqual(["1. 他们", "2. 赶紧"]);
    expect(answerKeyText("matching", { pairs: [{ left: "租 · zū", right: "thuê" }] }).lines).toEqual(["租 · zū → thuê"]);
    expect(
      answerKeyText("drag_drop_fill", { tokens: [{ label: "条件", blankIndex: 2 }, { label: "距离", blankIndex: null }, { label: "按时", blankIndex: 1 }] }).lines,
    ).toEqual(["[1] 按时", "[2] 条件"]);
  });

  it("câu mở (essay) và loại lạ: không có đáp án cố định", () => {
    expect(answerKeyText("essay", { rubric: "Chấm theo tiêu chí" })).toEqual({ lines: [], explanation: null, open: true });
    expect(answerKeyText("loai_la", {}).open).toBe(true);
    expect(answerKeyText("mcq", null).lines).toEqual([]);
  });
});
