import { describe, expect, it } from "vitest";
import { aiQuestionsToParseResult } from "../aiQuestionRows";

describe("aiQuestionsToParseResult — AI chỉ đọc hiểu, validate vẫn là logic xác định", () => {
  it("câu mcq hợp lệ: map đúng options theo thứ tự A, B, C...", () => {
    const r = aiQuestionsToParseResult([
      {
        type: "mcq",
        prompt: "Thủ đô Việt Nam?",
        options: [
          { label: "Hà Nội", isCorrect: true },
          { label: "Huế", isCorrect: false },
          { label: "Đà Nẵng", isCorrect: false },
        ],
        explanation: "Hà Nội là thủ đô.",
        topic: "Địa lý",
      },
    ]);
    expect(r.summary).toEqual({ ok: 1, warning: 0, error: 0, total: 1 });
    expect(r.rows[0]!.parsed).toMatchObject({
      type: "mcq",
      prompt: "Thủ đô Việt Nam?",
      explanation: "Hà Nội là thủ đô.",
      topic: "Địa lý",
      options: [
        { letter: "A", label: "Hà Nội", isCorrect: true },
        { letter: "B", label: "Huế", isCorrect: false },
        { letter: "C", label: "Đà Nẵng", isCorrect: false },
      ],
    });
  });

  it("nhiều đáp án đúng: Correct gộp đúng nhiều chữ cái", () => {
    const r = aiQuestionsToParseResult([
      {
        type: "mcq",
        prompt: "Số nào chia hết cho 3?",
        options: [
          { label: "9", isCorrect: true },
          { label: "10", isCorrect: false },
          { label: "12", isCorrect: true },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    const correct = r.rows[0]!.parsed!.options.filter((o) => o.isCorrect);
    expect(correct.map((o) => o.letter)).toEqual(["A", "C"]);
  });

  it("AI KHÔNG xác định được đáp án đúng (mọi option isCorrect=false): bị validate bắt lỗi, không phải AI tự đoán cho đủ", () => {
    const r = aiQuestionsToParseResult([
      {
        type: "mcq",
        prompt: "Câu hỏi mơ hồ, không thấy đáp án đúng trong văn bản gốc",
        options: [
          { label: "A", isCorrect: false },
          { label: "B", isCorrect: false },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors).toContain("Thiếu cột Correct (đáp án đúng)");
  });

  it("true_false: map thẳng qua, không cần OptionA/B tự chế (Correct suy từ options AI trả về)", () => {
    const r = aiQuestionsToParseResult([
      {
        type: "true_false",
        prompt: "Trái đất quay quanh Mặt trời.",
        options: [
          { label: "Đúng", isCorrect: true },
          { label: "Sai", isCorrect: false },
        ],
        explanation: null,
        topic: null,
      },
    ]);
    expect(r.rows[0]!.status).toBe("ok");
    expect(r.rows[0]!.parsed!.type).toBe("true_false");
  });

  it("quá 6 đáp án: chỉ lấy 6 đầu tiên (khớp giới hạn OptionA-F của Excel), không throw", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      label: `Đáp án ${i + 1}`,
      isCorrect: i === 0,
    }));
    const r = aiQuestionsToParseResult([
      { type: "mcq", prompt: "Q", options: many, explanation: null, topic: null },
    ]);
    expect(r.rows[0]!.parsed!.options).toHaveLength(6);
  });

  it("prompt rỗng: status error, không crash", () => {
    const r = aiQuestionsToParseResult([
      { type: "mcq", prompt: "", options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }], explanation: null, topic: null },
    ]);
    expect(r.rows[0]!.status).toBe("error");
  });

  it("mảng rỗng (AI không tìm thấy câu hỏi nào): trả result rỗng, không lỗi", () => {
    const r = aiQuestionsToParseResult([]);
    expect(r).toEqual({ rows: [], summary: { ok: 0, warning: 0, error: 0, total: 0 } });
  });

  it("nhiều câu hỏi: rowNumber theo đúng thứ tự xuất hiện trong văn bản gốc", () => {
    const r = aiQuestionsToParseResult([
      { type: "mcq", prompt: "Câu 1", options: [{label:"A",isCorrect:true},{label:"B",isCorrect:false}], explanation: null, topic: null },
      { type: "mcq", prompt: "Câu 2", options: [{label:"A",isCorrect:true},{label:"B",isCorrect:false}], explanation: null, topic: null },
    ]);
    expect(r.rows.map((row) => row.parsed?.prompt)).toEqual(["Câu 1", "Câu 2"]);
    expect(r.rows.map((row) => row.rowNumber)).toEqual([1, 2]);
  });
});
