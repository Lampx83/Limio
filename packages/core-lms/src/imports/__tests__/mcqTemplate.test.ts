import { describe, expect, it } from "vitest";
import { parseRawMcqRows } from "../mcqTemplate";

const okMcqRow = (over: Partial<Record<string, string>> = {}) => ({
  Prompt: "Thủ đô của Việt Nam là gì?",
  OptionA: "Hà Nội",
  OptionB: "TP. Hồ Chí Minh",
  Correct: "A",
  ...over,
});

describe("parseRawMcqRows — hàm validate dùng chung cho Excel và AI import", () => {
  it("câu hợp lệ: status ok, giữ đúng nội dung", () => {
    const r = parseRawMcqRows([okMcqRow()]);
    expect(r.summary).toEqual({ ok: 1, warning: 0, error: 0, total: 1 });
    expect(r.rows[0]!.status).toBe("ok");
    expect(r.rows[0]!.parsed).toMatchObject({
      type: "mcq",
      prompt: "Thủ đô của Việt Nam là gì?",
      options: [
        { letter: "A", label: "Hà Nội", isCorrect: true },
        { letter: "B", label: "TP. Hồ Chí Minh", isCorrect: false },
      ],
    });
  });

  it("true_false không điền option: tự điền Đúng/Sai", () => {
    const r = parseRawMcqRows([
      { Prompt: "Trái đất tròn.", Type: "true_false", Correct: "A" },
    ]);
    expect(r.rows[0]!.status).toBe("ok");
    expect(r.rows[0]!.parsed!.options).toEqual([
      { letter: "A", label: "Đúng", isCorrect: true },
      { letter: "B", label: "Sai", isCorrect: false },
    ]);
  });

  it("thiếu Prompt: status error, không có field parsed", () => {
    const r = parseRawMcqRows([okMcqRow({ Prompt: "" })]);
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors).toContain("Thiếu cột Prompt (câu hỏi)");
    expect(r.rows[0]!.parsed).toBeUndefined();
  });

  it("thiếu đáp án đúng: status error", () => {
    const r = parseRawMcqRows([okMcqRow({ Correct: "" })]);
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors).toContain("Thiếu cột Correct (đáp án đúng)");
  });

  it("nhiều đáp án đúng (Correct='A,C'): vẫn ok, cả hai đều isCorrect", () => {
    const r = parseRawMcqRows([
      okMcqRow({ OptionC: "Đà Nẵng", Correct: "A,C" }),
    ]);
    expect(r.rows[0]!.status).toBe("ok");
    const correct = r.rows[0]!.parsed!.options.filter((o) => o.isCorrect);
    expect(correct.map((o) => o.letter)).toEqual(["A", "C"]);
  });

  it("nhiều dòng: summary đếm đúng theo từng trạng thái, rowNumber theo thứ tự", () => {
    const r = parseRawMcqRows([okMcqRow(), okMcqRow({ Prompt: "" }), okMcqRow({ Points: "999" })]);
    expect(r.summary).toEqual({ ok: 1, warning: 1, error: 1, total: 3 });
    expect(r.rows.map((row) => row.rowNumber)).toEqual([1, 2, 3]);
  });

  it("không tự chuẩn hoá alias cột (đầu vào phải đã đúng tên canonical) — khác parseMcqImportXlsx", () => {
    // parseRawMcqRows là lớp dưới, không tự map "câu hỏi" -> "Prompt". Bên gọi
    // (xlsx parser hoặc AI adapter) phải tự đưa đúng key canonical vào.
    const r = parseRawMcqRows([{ "câu hỏi": "X", OptionA: "a", OptionB: "b", Correct: "A" }]);
    expect(r.rows[0]!.status).toBe("error");
    expect(r.rows[0]!.errors).toContain("Thiếu cột Prompt (câu hỏi)");
  });
});
