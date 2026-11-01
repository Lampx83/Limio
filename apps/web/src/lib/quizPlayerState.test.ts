import { describe, expect, it } from "vitest";
import {
  answerSignature,
  flagStorageKey,
  isOptionsCovered,
  isWorkOnPaper,
  joinNumbers,
  leaveWarning,
  parseFlagged,
  questionStatus,
  saveStatusText,
  showWorkOnPaperIntro,
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
  it("mọi câu đã lưu thì cho rời đi không hỏi", () => {
    expect(leaveWarning([])).toBeNull();
  });
  it("nói rõ câu nào sẽ mất", () => {
    expect(leaveWarning([4])).toContain("Câu 4 chưa được lưu");
    expect(leaveWarning([4])).toContain("câu đó");
    expect(leaveWarning([4, 7])).toContain("những câu đó");
  });
});

describe("answerSignature", () => {
  it("cùng nội dung và độ tự tin thì cùng chữ ký", () => {
    expect(answerSignature(["a"], 3)).toBe(answerSignature(["a"], 3));
  });
  it("đổi đáp án hoặc độ tự tin thì khác chữ ký", () => {
    expect(answerSignature(["a"], 3)).not.toBe(answerSignature(["b"], 3));
    expect(answerSignature(["a"], 3)).not.toBe(answerSignature(["a"], 4));
  });
  it("không có độ tự tin và undefined coi như nhau", () => {
    expect(answerSignature("x", null)).toBe(answerSignature("x", null));
    expect(answerSignature(undefined, null)).toBe(answerSignature(null, null));
  });
});

describe("saveStatusText", () => {
  const clock = (ms: number) => `giờ-${ms}`;
  it("đang lưu", () => {
    expect(saveStatusText({ kind: "saving" }, 0, clock)).toBe("Đang lưu…");
  });
  it("lỗi mạng thì bảo người học làm gì tiếp", () => {
    expect(saveStatusText({ kind: "error" }, 1, clock)).toContain("Chưa lưu được");
  });
  it("còn câu chưa lưu thì nói số câu, không báo đã lưu", () => {
    expect(saveStatusText({ kind: "saved", at: 1 }, 2, clock)).toBe("Còn 2 câu chưa được lưu.");
  });
  it("đã lưu hết thì báo giờ", () => {
    expect(saveStatusText({ kind: "saved", at: 5 }, 0, clock)).toBe("Đã lưu lúc giờ-5.");
  });
  it("chưa làm gì thì nói bài được lưu khi chọn xong mỗi câu", () => {
    expect(saveStatusText({ kind: "idle" }, 0, clock)).toContain("lưu ngay khi bạn chọn xong");
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

describe("nháp ra giấy", () => {
  const paper = { type: "mcq", extra: { manifestKey: "a", workOnPaper: true } };
  const plain = { type: "mcq", extra: { manifestKey: "b" } };
  const base = { hasSavedAnswers: false, timeLimitSec: null, prepared: false };

  it("chỉ nhận câu có phương án để nhìn", () => {
    expect(isWorkOnPaper(paper)).toBe(true);
    expect(isWorkOnPaper({ type: "true_false", extra: { workOnPaper: true } })).toBe(true);
    expect(isWorkOnPaper(plain)).toBe(false);
    expect(isWorkOnPaper({ type: "mcq", extra: null })).toBe(false);
    expect(isWorkOnPaper({ type: "mcq" })).toBe(false);
    expect(isWorkOnPaper({ type: "fill_in", extra: { workOnPaper: true } })).toBe(false);
    expect(isWorkOnPaper({ type: "matching", extra: { workOnPaper: true } })).toBe(false);
  });

  it("hiện màn chuẩn bị khi quiz có câu đánh dấu và lượt làm còn mới", () => {
    expect(showWorkOnPaperIntro({ ...base, questions: [plain, paper] })).toBe(true);
  });
  it("quiz không đánh dấu thì không hiện", () => {
    expect(showWorkOnPaperIntro({ ...base, questions: [plain] })).toBe(false);
  });
  it("đã qua màn chuẩn bị thì không hiện lại", () => {
    expect(showWorkOnPaperIntro({ ...base, questions: [paper], prepared: true })).toBe(false);
  });
  it("đã có câu trả lời thì vào thẳng bài làm", () => {
    expect(showWorkOnPaperIntro({ ...base, questions: [paper], hasSavedAnswers: true })).toBe(false);
  });
  it("có giới hạn thời gian thì không hiện", () => {
    expect(showWorkOnPaperIntro({ ...base, questions: [paper], timeLimitSec: 600 })).toBe(false);
  });

  it("câu đánh dấu chưa mở và chưa trả lời thì bị che", () => {
    expect(isOptionsCovered(paper, { hasResponse: false, revealed: false })).toBe(true);
  });
  it("đã mở thì không che", () => {
    expect(isOptionsCovered(paper, { hasResponse: false, revealed: true })).toBe(false);
  });
  it("đã có trả lời thì không che dù vừa tải lại trang", () => {
    expect(isOptionsCovered(paper, { hasResponse: true, revealed: false })).toBe(false);
  });
  it("câu không đánh dấu không bao giờ bị che", () => {
    expect(isOptionsCovered(plain, { hasResponse: false, revealed: false })).toBe(false);
    expect(isOptionsCovered({ type: "fill_in", extra: { workOnPaper: true } }, { hasResponse: false, revealed: false })).toBe(false);
  });
});
