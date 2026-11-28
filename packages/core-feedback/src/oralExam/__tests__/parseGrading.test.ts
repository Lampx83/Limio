import { describe, expect, it } from "vitest";
import { UNREADABLE_AI_SUMMARY, parseGradingResponse } from "../evaluation";

describe("parseGradingResponse", () => {
  it("đọc JSON đầy đủ", () => {
    const r = parseGradingResponse('{"score": 80, "summary": "Tốt.", "breakdown": [{"topic": "A", "note": "ổn"}]}');
    expect(r).toEqual({ score: 80, summary: "Tốt.", breakdown: [{ topic: "A", note: "ổn" }] });
  });

  it("JSON bị cắt giữa chừng: giữ điểm, nhận xét và các mục đã đóng ngoặc", () => {
    const raw =
      '{\n  "score": 85,\n  "summary": "Sinh viên nắm vững \\"cơ bản\\".",\n  "breakdown": [\n    {"topic": "Thuốc 1", "note": "Đúng."},\n    {"topic": "Thuốc 2", "note": "Phân nhóm chưa';
    const r = parseGradingResponse(raw);
    expect(r.score).toBe(85);
    expect(r.summary).toBe('Sinh viên nắm vững "cơ bản".');
    expect(r.breakdown).toEqual([{ topic: "Thuốc 1", note: "Đúng." }]);
  });

  it("JSON hỏng không có điểm: không đoán điểm, không để JSON thô thành nhận xét", () => {
    const r = parseGradingResponse('{ "summary": "dở dang');
    expect(r.score).toBeNull();
    expect(r.summary).toBe(UNREADABLE_AI_SUMMARY);
    expect(r.summary).not.toContain("{");
  });

  it("điểm ngoài 0-100 trong JSON bị cắt thì không nhận", () => {
    expect(parseGradingResponse('{"score": 850, "summary": "x", "breakdown": [{"topic":"a"').score).toBeNull();
  });

  it("văn xuôi không phải JSON vẫn giữ nguyên cho giảng viên đọc", () => {
    const r = parseGradingResponse("Em xin lỗi, không chấm được.");
    expect(r.score).toBeNull();
    expect(r.summary).toBe("Em xin lỗi, không chấm được.");
  });
});
