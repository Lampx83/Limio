import { describe, expect, it } from "vitest";
import {
  flagStorageKey,
  joinNumbers,
  leaveWarning,
  parseFlagged,
  questionStatus,
  submitWarning,
} from "./quizPlayerState";

describe("questionStatus", () => {
  it("chưa chọn đáp án thì là empty, dù có độ tự tin", () => {
    expect(questionStatus({ hasResponse: false, confidence: 4, requireConfidence: true })).toBe("empty");
  });
  it("đã chọn đáp án nhưng thiếu độ tự tin khi quiz bắt buộc thì cần bổ sung", () => {
    expect(questionStatus({ hasResponse: true, confidence: null, requireConfidence: true })).toBe(
      "needs-confidence",
    );
  });
  it("quiz không bắt buộc độ tự tin thì có đáp án là xong", () => {
    expect(questionStatus({ hasResponse: true, confidence: null, requireConfidence: false })).toBe("done");
  });
  it("đủ đáp án và độ tự tin thì xong", () => {
    expect(questionStatus({ hasResponse: true, confidence: 3, requireConfidence: true })).toBe("done");
  });
});

describe("joinNumbers", () => {
  it("nối số câu theo cách đọc tự nhiên", () => {
    expect(joinNumbers([])).toBe("");
    expect(joinNumbers([3])).toBe("3");
    expect(joinNumbers([3, 5])).toBe("3 và 5");
    expect(joinNumbers([3, 5, 7])).toBe("3, 5 và 7");
  });
});

describe("submitWarning", () => {
  it("không còn gì cần nhắc thì không hỏi", () => {
    expect(submitWarning({ empty: [], needsConfidence: [], flagged: [] })).toBeNull();
  });
  it("gọi đúng tên từng câu thiếu", () => {
    const msg = submitWarning({ empty: [2, 9], needsConfidence: [4], flagged: [] });
    expect(msg).toContain("Câu 2 và 9 bạn chưa trả lời.");
    expect(msg).toContain("Câu 4 bạn đã chọn đáp án nhưng chưa chọn độ tự tin");
    expect(msg).toContain("sẽ tính là bỏ trống");
    expect(msg).not.toContain("đánh dấu");
    expect(msg).toContain("không sửa lại được");
  });
  it("chỉ còn câu đánh dấu cũng hỏi lại một lần", () => {
    const msg = submitWarning({ empty: [], needsConfidence: [], flagged: [1, 6, 8] });
    expect(msg).toContain("Câu 1, 6 và 8 bạn đã đánh dấu để xem lại.");
    expect(msg).not.toContain("chưa trả lời");
  });
});

describe("leaveWarning", () => {
  it("chưa chọn gì thì cho rời đi không hỏi", () => {
    expect(leaveWarning(0)).toBeNull();
  });
  it("nói đúng số câu sẽ mất và việc phải làm lại", () => {
    const msg = leaveWarning(5);
    expect(msg).toContain("Bạn chưa nộp bài.");
    expect(msg).toContain("5 câu");
    expect(msg).toContain("chỉ được ghi nhận khi bạn bấm");
    expect(msg).toContain("phải chọn lại");
  });
});

describe("parseFlagged", () => {
  const valid = new Set(["a", "b", "c"]);
  it("không có dữ liệu thì rỗng", () => {
    expect(parseFlagged(null, valid).size).toBe(0);
  });
  it("bỏ qua dữ liệu hỏng", () => {
    expect(parseFlagged("{không phải json", valid).size).toBe(0);
    expect(parseFlagged('{"a":1}', valid).size).toBe(0);
  });
  it("chỉ giữ câu còn thuộc đề này", () => {
    expect([...parseFlagged('["a","zzz",3,"c"]', valid)].sort()).toEqual(["a", "c"]);
  });
  it("khoá lưu theo từng lượt làm bài", () => {
    expect(flagStorageKey("att-1")).toBe("quiz-flags:att-1");
  });
});
