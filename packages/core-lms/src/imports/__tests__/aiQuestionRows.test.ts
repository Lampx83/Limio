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

  // Sự cố thật (2026-09-22): trước đây "Sắp xếp thứ tự"/"Ghép cặp" bị ép vào
  // mcq. Nay hai loại này có đường riêng, giữ đúng ngữ nghĩa gốc (chuỗi thứ tự
  // / cặp ghép) thay vì giả vờ là "chọn đáp án đúng trong N option".

  describe("ordering — Sắp xếp thứ tự", () => {
    it("hợp lệ: items giữ ĐÚNG thứ tự AI trả về (đó là đáp án đúng)", () => {
      const r = aiQuestionsToParseResult([
        {
          type: "ordering",
          prompt: "Sắp xếp thành câu đúng",
          items: [{ label: "邮局" }, { label: "我" }, { label: "去" }],
          explanation: null,
          topic: "Bài 21",
        },
      ]);
      expect(r.rows[0]!.status).toBe("ok");
      expect(r.rows[0]!.parsed).toMatchObject({
        type: "ordering",
        prompt: "Sắp xếp thành câu đúng",
        options: [],
        topic: "Bài 21",
      });
      expect(r.rows[0]!.parsed!.items!.map((i) => i.label)).toEqual(["邮局", "我", "去"]);
      // id phải tồn tại và không trùng nhau (OrderingConfig yêu cầu id duy nhất).
      const ids = r.rows[0]!.parsed!.items!.map((i) => i.id);
      expect(new Set(ids).size).toBe(3);
    });

    it("dưới 2 mảnh: status error (OrderingConfig từ chối)", () => {
      const r = aiQuestionsToParseResult([
        { type: "ordering", prompt: "Q", items: [{ label: "một mảnh" }], explanation: null, topic: null },
      ]);
      expect(r.rows[0]!.status).toBe("error");
      expect(r.rows[0]!.parsed).toBeUndefined();
    });

    it("prompt rỗng: error", () => {
      const r = aiQuestionsToParseResult([
        { type: "ordering", prompt: "", items: [{ label: "a" }, { label: "b" }], explanation: null, topic: null },
      ]);
      expect(r.rows[0]!.status).toBe("error");
    });
  });

  describe("matching — Ghép cặp", () => {
    it("hợp lệ: mỗi pair giữ cả left/right, có id duy nhất", () => {
      const r = aiQuestionsToParseResult([
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
      expect(r.rows[0]!.status).toBe("ok");
      expect(r.rows[0]!.parsed).toMatchObject({ type: "matching", options: [] });
      expect(r.rows[0]!.parsed!.pairs).toEqual([
        expect.objectContaining({ left: "寄", right: "gửi" }),
        expect.objectContaining({ left: "包裹", right: "bưu kiện" }),
      ]);
      const ids = r.rows[0]!.parsed!.pairs!.map((p) => p.id);
      expect(new Set(ids).size).toBe(2);
    });

    it("dưới 2 cặp: status error (MatchingConfig từ chối)", () => {
      const r = aiQuestionsToParseResult([
        { type: "matching", prompt: "Q", pairs: [{ left: "a", right: "b" }], explanation: null, topic: null },
      ]);
      expect(r.rows[0]!.status).toBe("error");
    });

    it("thiếu right (AI không xác định được nghĩa ghép đúng): error, không tự bịa", () => {
      const r = aiQuestionsToParseResult([
        {
          type: "matching",
          prompt: "Q",
          pairs: [{ left: "a", right: "" }, { left: "b", right: "y" }],
          explanation: null,
          topic: null,
        },
      ]);
      expect(r.rows[0]!.status).toBe("error");
    });
  });

  describe("fill_in — Điền khuyết", () => {
    it("hợp lệ: giữ prompt (kèm chỗ trống) và danh sách đáp án chấp nhận", () => {
      const r = aiQuestionsToParseResult([
        {
          type: "fill_in",
          prompt: "我明天＿＿上海。",
          acceptedAnswers: ["去", "qù"],
          explanation: null,
          topic: "Bài 21",
        },
      ]);
      expect(r.rows[0]!.status).toBe("ok");
      expect(r.rows[0]!.parsed).toMatchObject({
        type: "fill_in",
        prompt: "我明天＿＿上海。",
        options: [],
        acceptedAnswers: ["去", "qù"],
        topic: "Bài 21",
      });
    });

    it("không có đáp án nào (AI không xác định được): error, không tự bịa", () => {
      const r = aiQuestionsToParseResult([
        { type: "fill_in", prompt: "Câu mơ hồ ＿＿", acceptedAnswers: [], explanation: null, topic: null },
      ]);
      expect(r.rows[0]!.status).toBe("error");
    });

    it("prompt rỗng: error", () => {
      const r = aiQuestionsToParseResult([
        { type: "fill_in", prompt: "", acceptedAnswers: ["x"], explanation: null, topic: null },
      ]);
      expect(r.rows[0]!.status).toBe("error");
    });

    it("đáp án rỗng/khoảng trắng bị lọc bỏ trước khi validate", () => {
      const r = aiQuestionsToParseResult([
        { type: "fill_in", prompt: "Q ＿＿", acceptedAnswers: ["x", "  ", ""], explanation: null, topic: null },
      ]);
      expect(r.rows[0]!.status).toBe("ok");
      expect(r.rows[0]!.parsed!.acceptedAnswers).toEqual(["x"]);
    });
  });

  it("trộn lẫn mcq/ordering/matching/fill_in trong cùng văn bản: rowNumber vẫn đúng thứ tự xuất hiện", () => {
    const r = aiQuestionsToParseResult([
      { type: "mcq", prompt: "Câu 1", options: [{label:"A",isCorrect:true},{label:"B",isCorrect:false}], explanation: null, topic: null },
      { type: "ordering", prompt: "Câu 2", items: [{label:"a"},{label:"b"}], explanation: null, topic: null },
      { type: "matching", prompt: "Câu 3", pairs: [{left:"a",right:"x"},{left:"b",right:"y"}], explanation: null, topic: null },
      { type: "fill_in", prompt: "Câu 4 ＿＿", acceptedAnswers: ["x"], explanation: null, topic: null },
    ]);
    expect(r.rows.map((row) => row.parsed?.type)).toEqual(["mcq", "ordering", "matching", "fill_in"]);
    expect(r.rows.map((row) => row.rowNumber)).toEqual([1, 2, 3, 4]);
    expect(r.summary).toEqual({ ok: 4, warning: 0, error: 0, total: 4 });
  });
});
