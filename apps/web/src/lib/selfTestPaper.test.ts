import { describe, expect, it } from "vitest";
import { audioPlaysOf, optionLetter, paperOutline, paperSectionOf, sectionBreakdown, startsPart } from "./selfTestPaper";

const L1 = { section: { key: "listening", label: "听力 · Nghe", part: "第一部分", intro: "第1-6题：听对话，选出正确答案。" } };
const R1 = { section: { key: "reading", label: "阅读 · Đọc", part: "第一部分" } };
const R2 = { section: { key: "reading", label: "阅读 · Đọc", part: "第二部分" } };

describe("mini-test mô phỏng đề HSK", () => {
  it("đọc phần thi từ extra, bỏ dữ liệu sai", () => {
    expect(paperSectionOf(L1)).toEqual({ key: "listening", label: "听力 · Nghe", part: "第一部分", intro: "第1-6题：听对话，选出正确答案。" });
    expect(paperSectionOf(R1)).toEqual({ key: "reading", label: "阅读 · Đọc", part: "第一部分", intro: null });
    expect(paperSectionOf({ section: { key: "speaking", label: "x" } })).toBeNull();
    expect(paperSectionOf({ section: { key: "reading" } })).toBeNull();
    expect(paperSectionOf({ section: "reading" })).toBeNull();
    expect(paperSectionOf(null)).toBeNull();
    expect(paperSectionOf({})).toBeNull();
  });

  it("số lần phát audio: chỉ nhận số nguyên 1–5", () => {
    expect(audioPlaysOf({ audioPlays: 1 })).toBe(1);
    expect(audioPlaysOf({ audioPlays: 2 })).toBe(2);
    for (const bad of [0, -1, 1.5, 6, "1", null, undefined]) expect(audioPlaysOf({ audioPlays: bad })).toBeNull();
    expect(audioPlaysOf(null)).toBeNull();
    expect(audioPlaysOf({})).toBeNull();
  });

  it("chữ cái phương án A B C D", () => {
    expect([0, 1, 2, 3, 5].map(optionLetter)).toEqual(["A", "B", "C", "D", "F"]);
  });

  it("khung hướng dẫn hiện ở câu đầu mỗi phần và mỗi phần nhỏ", () => {
    expect(startsPart(undefined, L1)).toBe(true);
    expect(startsPart(L1, L1)).toBe(false);
    expect(startsPart(L1, R1)).toBe(true);
    expect(startsPart(R1, R2)).toBe(true);
    expect(startsPart(R1, R1)).toBe(false);
    expect(startsPart(L1, {})).toBe(false);
  });

  it("điểm theo phần theo thứ tự nghe, đọc, viết", () => {
    const items = [
      { extra: R1, isCorrect: true },
      { extra: L1, isCorrect: true },
      { extra: L1, isCorrect: false },
      { extra: R2, isCorrect: false },
      { extra: null, isCorrect: true },
    ];
    expect(sectionBreakdown(items)).toEqual([
      { key: "listening", label: "听力 · Nghe", correct: 1, total: 2 },
      { key: "reading", label: "阅读 · Đọc", correct: 1, total: 2 },
    ]);
    expect(sectionBreakdown([])).toEqual([]);
  });

  it("cấu trúc đề cho màn hướng dẫn: số câu mỗi phần, nghe một lần hay không", () => {
    const qs = [
      { extra: { ...L1, audioUrl: "/api/lesson-media/audio/a.mp3", audioPlays: 1 } },
      { extra: { ...L1, audioUrl: "/api/lesson-media/audio/b.mp3", audioPlays: 1 } },
      { extra: R1 },
      { extra: R2 },
      { extra: {} },
    ];
    expect(paperOutline(qs)).toEqual([
      { key: "listening", label: "听力 · Nghe", count: 2, listenOnce: true },
      { key: "reading", label: "阅读 · Đọc", count: 2, listenOnce: false },
    ]);
    expect(paperOutline([{ extra: { ...L1, audioUrl: "/x.mp3", audioPlays: 1 } }, { extra: { ...L1, audioUrl: "/y.mp3" } }])[0]!.listenOnce).toBe(false);
  });
});
