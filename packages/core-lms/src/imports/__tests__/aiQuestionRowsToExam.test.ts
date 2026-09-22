import { describe, expect, it } from "vitest";
import { aiQuestionsToExamRows } from "../aiQuestionRowsToExam";

describe("aiQuestionsToExamRows", () => {
  it("mcq: tạo row status=ok, config.options giữ đúng label/isCorrect", () => {
    const { rows } = aiQuestionsToExamRows([
      {
        type: "mcq",
        prompt: "1+1=?",
        options: [
          { label: "2", isCorrect: true },
          { label: "3", isCorrect: false },
        ],
        explanation: "Vì 1+1=2",
        topic: null,
      },
    ]);
    expect(rows[0]!.status).toBe("ok");
    const p = rows[0]!.parsed!;
    expect(p.type).toBe("mcq");
    expect(p.prompt).toBe("1+1=?");
    expect(p.passageId).toBeNull();
    const cfg = p.config as { options: Array<{ label: string; isCorrect: boolean }>; explanation?: string };
    expect(cfg.options).toEqual([
      { id: "a", label: "2", isCorrect: true },
      { id: "b", label: "3", isCorrect: false },
    ]);
    expect(cfg.explanation).toBe("Vì 1+1=2");
  });

  it("mcq không có đáp án đúng nào: status=error (Zod McqConfig bắt, không phải AI tự quyết)", () => {
    const { rows } = aiQuestionsToExamRows([
      {
        type: "mcq",
        prompt: "Q",
        options: [
          { label: "A", isCorrect: false },
          { label: "B", isCorrect: false },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    expect(rows[0]!.status).toBe("error");
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it("true_false: map sang type=true_false_notgiven, correct suy từ NỘI DUNG nhãn — không phải vị trí", () => {
    const { rows } = aiQuestionsToExamRows([
      {
        type: "true_false",
        prompt: "Trái đất phẳng.",
        options: [
          { label: "Sai", isCorrect: true },
          { label: "Đúng", isCorrect: false },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    expect(rows[0]!.status).toBe("ok");
    const p = rows[0]!.parsed!;
    expect(p.type).toBe("true_false_notgiven");
    expect((p.config as { correct: string }).correct).toBe("false");
  });

  it("true_false thứ tự thuận: correct = 'true'", () => {
    const { rows } = aiQuestionsToExamRows([
      {
        type: "true_false",
        prompt: "Trái đất tròn.",
        options: [
          { label: "Đúng", isCorrect: true },
          { label: "Sai", isCorrect: false },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    const p = rows[0]!.parsed!;
    expect((p.config as { correct: string }).correct).toBe("true");
  });

  it("ordering: type=ordering, items giữ đúng thứ tự AI trả về", () => {
    const { rows } = aiQuestionsToExamRows([
      {
        type: "ordering",
        prompt: "Sắp xếp thành câu đúng",
        items: [{ label: "邮局" }, { label: "我" }, { label: "去" }],
        explanation: null,
        topic: "Bài 21",
      },
    ]);
    expect(rows[0]!.status).toBe("ok");
    const p = rows[0]!.parsed!;
    expect(p.type).toBe("ordering");
    const cfg = p.config as { items: Array<{ label: string }> };
    expect(cfg.items.map((i) => i.label)).toEqual(["邮局", "我", "去"]);
  });

  it("matching: type=matching, pairs giữ đúng left/right", () => {
    const { rows } = aiQuestionsToExamRows([
      {
        type: "matching",
        prompt: "Ghép từ Hán với nghĩa tiếng Việt",
        pairs: [
          { left: "寄", right: "gửi" },
          { left: "包裹", right: "bưu kiện" },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    expect(rows[0]!.status).toBe("ok");
    const p = rows[0]!.parsed!;
    expect(p.type).toBe("matching");
    const cfg = p.config as { pairs: Array<{ left: string; right: string }> };
    expect(cfg.pairs).toEqual([
      expect.objectContaining({ left: "寄", right: "gửi" }),
      expect.objectContaining({ left: "包裹", right: "bưu kiện" }),
    ]);
  });

  it("fill_in: map sang type=short_answer, acceptedAnswers + matchMode case_insensitive", () => {
    const { rows } = aiQuestionsToExamRows([
      {
        type: "fill_in",
        prompt: "我明天＿＿上海。",
        acceptedAnswers: ["去", "qù"],
        explanation: null,
        topic: null,
      },
    ]);
    expect(rows[0]!.status).toBe("ok");
    const p = rows[0]!.parsed!;
    expect(p.type).toBe("short_answer");
    const cfg = p.config as { acceptedAnswers: string[]; matchMode: string };
    expect(cfg.acceptedAnswers).toEqual(["去", "qù"]);
    expect(cfg.matchMode).toBe("case_insensitive");
  });

  it("giữ đúng thứ tự rowNumber khi trộn nhiều loại", () => {
    const { rows } = aiQuestionsToExamRows([
      { type: "mcq", prompt: "Q1", options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }], explanation: null, topic: null },
      { type: "ordering", prompt: "Q2", items: [{ label: "a" }, { label: "b" }], explanation: null, topic: null },
    ]);
    expect(rows.map((r) => r.rowNumber)).toEqual([1, 2]);
    expect(rows.every((r) => r.status === "ok")).toBe(true);
  });
});
