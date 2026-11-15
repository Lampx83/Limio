import { describe, expect, it } from "vitest";
import { buildSheetSteps, buildSteps, countProgress, instructionOnlyText, isShortAudioPassage, parseLayoutPref, progressLabel, readLayoutPref, stepIndexOf, summaryRows, writeLayoutPref } from "./lessonPracticeView";

const q = (id: string, passageId: string | null = null) => ({ id, passageId });

describe("buildSteps", () => {
  it("câu liền nhau cùng đoạn văn gộp một bước; câu không đoạn mỗi câu một bước; đổi đoạn là bước mới", () => {
    const steps = buildSteps([q("a", "p1"), q("b", "p1"), q("c"), q("d"), q("e", "p2"), q("f", "p1")]);
    expect(steps.map((s) => s.questionIds)).toEqual([["a", "b"], ["c"], ["d"], ["e"], ["f"]]);
    expect(steps.map((s) => s.passageId)).toEqual(["p1", null, null, "p2", "p1"]);
  });
  it("khoá bước không trùng nhau", () => {
    const steps = buildSteps([q("a", "p1"), q("b"), q("c")]);
    expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length);
  });
  it("rỗng thì không có bước", () => {
    expect(buildSteps([])).toEqual([]);
  });
});

describe("countProgress / progressLabel", () => {
  it("mỗi câu thuộc đúng một nhóm; đã kiểm tra thắng đã chọn", () => {
    const answered = new Set(["a", "b", "c"]);
    const checked = new Set(["a"]);
    const c = countProgress(["a", "b", "c", "d"], (id) => answered.has(id), (id) => checked.has(id));
    expect(c).toEqual({ checked: 1, chosen: 2, unanswered: 1, total: 4 });
    expect(progressLabel(c)).toBe("1 đã kiểm tra · 2 đã chọn · 1 chưa trả lời");
  });
});

describe("stepIndexOf", () => {
  it("tìm bước chứa câu, -1 nếu không có", () => {
    const steps = buildSteps([q("a", "p1"), q("b", "p1"), q("c")]);
    expect(stepIndexOf(steps, "b")).toBe(0);
    expect(stepIndexOf(steps, "c")).toBe(1);
    expect(stepIndexOf(steps, "zzz")).toBe(-1);
  });
});

describe("summaryRows", () => {
  it("đặt tên kỹ năng tiếng Việt, câu chấm tay không tính vào mẫu số", () => {
    expect(summaryRows([{ skill: "reading", correct: 2, total: 4, manual: 1 }, { skill: "xyz", correct: 0, total: 1, manual: 0 }])).toEqual([
      { skill: "reading", label: "Đọc", correct: 2, total: 3 },
      { skill: "xyz", label: "xyz", correct: 0, total: 1 },
    ]);
  });
});

describe("lựa chọn bố cục", () => {
  it("chỉ 'single' mới là một cột; mọi giá trị khác về chia đôi", () => {
    expect(parseLayoutPref("single")).toBe("single");
    for (const v of [null, undefined, "", "split", "x", 5]) expect(parseLayoutPref(v)).toBe("split");
  });
  it("đọc/ghi qua lưu trữ; lưu trữ ném lỗi thì không vỡ và dùng mặc định", () => {
    const mem: Record<string, string> = {};
    const ok = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) };
    expect(readLayoutPref(ok)).toBe("split");
    writeLayoutPref(ok, "single");
    expect(readLayoutPref(ok)).toBe("single");
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readLayoutPref(bad)).toBe("split");
    expect(() => writeLayoutPref(bad, "single")).not.toThrow();
    expect(readLayoutPref(null)).toBe("split");
  });
});

describe("buildSheetSteps (Phiếu bài tập)", () => {
  it("gộp các câu liền nhau không có đoạn văn thành MỘT bước (khác buildSteps: mỗi câu một bước)", () => {
    const qs = [
      { id: "a", passageId: null },
      { id: "b", passageId: null },
      { id: "c", passageId: "p1" },
      { id: "d", passageId: "p1" },
      { id: "e", passageId: null },
    ];
    expect(buildSheetSteps(qs).map((s) => s.questionIds)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(buildSteps(qs).map((s) => s.questionIds)).toEqual([["a"], ["b"], ["c", "d"], ["e"]]);
  });

  it("đoạn văn không có câu hỏi vẫn là một bước, chèn theo thứ tự đoạn văn của đề", () => {
    const qs = [
      { id: "a", passageId: "p1" },
      { id: "b", passageId: "p3" },
    ];
    expect(buildSheetSteps(qs, ["p1", "p2", "p3"]).map((s) => [s.passageId, s.questionIds])).toEqual([
      ["p1", ["a"]],
      ["p2", []],
      ["p3", ["b"]],
    ]);
    expect(buildSheetSteps(qs, ["p1", "p3", "p4"]).map((s) => s.passageId)).toEqual(["p1", "p3", "p4"]); // đoạn rỗng ở cuối
    expect(buildSheetSteps(qs).map((s) => s.passageId)).toEqual(["p1", "p3"]); // không biết thứ tự đoạn thì như cũ
  });
});

describe("instructionOnlyText — đoạn văn chỉ là câu yêu cầu", () => {
  const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const doc = (...content: unknown[]) => ({ type: "doc", content });
  it("vài đoạn chữ ngắn: trả chữ thuần, các đoạn cách nhau một dòng trống", () => {
    expect(instructionOnlyText(doc(para("Read sentences 1–4."), para(" Answer the questions. ")))).toBe("Read sentences 1–4.\n\nAnswer the questions.");
    expect(instructionOnlyText(doc({ type: "paragraph", content: [{ type: "text", text: "A" }, { type: "hardBreak" }, { type: "text", text: "B" }] }))).toBe("A\nB");
  });
  it("có tiêu đề, danh sách, bảng, ảnh, audio hoặc nút nhúng thì là nội dung thật (null)", () => {
    for (const node of [{ type: "heading", content: [{ type: "text", text: "T" }] }, { type: "bulletList" }, { type: "table" }, { type: "image" }, { type: "audio" }]) {
      expect(instructionOnlyText(doc(para("Listen."), node))).toBeNull();
    }
    expect(instructionOnlyText(doc({ type: "paragraph", content: [{ type: "image" }] }))).toBeNull();
  });
  it("quá dài (bài đọc), rỗng hoặc không phải tài liệu thì null", () => {
    expect(instructionOnlyText(doc(para("x ".repeat(250))))).toBeNull();
    expect(instructionOnlyText(doc(para("   ")))).toBeNull();
    expect(instructionOnlyText(doc())).toBeNull();
    expect(instructionOnlyText(null)).toBeNull();
    expect(instructionOnlyText({ type: "other" })).toBeNull();
  });
});

describe("isShortAudioPassage — bài nghe chỉ có câu yêu cầu và trình phát", () => {
  const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const doc = (...content: unknown[]) => ({ type: "doc", content });
  it("chữ ngắn kèm audio (kể cả chỉ audio) thì đúng", () => {
    expect(isShortAudioPassage(doc(para("Listen and complete."), { type: "audio" }))).toBe(true);
    expect(isShortAudioPassage(doc({ type: "audio" }))).toBe(true);
  });
  it("không có audio, có bảng/ảnh/danh sách/tiêu đề, hoặc chữ dài (có bài đọc) thì sai", () => {
    expect(isShortAudioPassage(doc(para("Only text.")))).toBe(false);
    for (const node of [{ type: "table" }, { type: "image" }, { type: "orderedList" }, { type: "heading" }]) {
      expect(isShortAudioPassage(doc({ type: "audio" }, node))).toBe(false);
    }
    expect(isShortAudioPassage(doc({ type: "audio" }, para("x ".repeat(250))))).toBe(false);
    expect(isShortAudioPassage(null)).toBe(false);
  });
});
