import { describe, expect, it } from "vitest";
import { splitTrailingHint } from "./practiceHint";

describe("splitTrailingHint", () => {
  it("tách gợi ý 'gõ một từ…, nghĩa: …' ở cuối đề", () => {
    const r = splitTrailingHint("图里的人没有马上回答，他说：“让我再____一下。”(gõ một từ tiếng Trung, nghĩa: suy nghĩ, cân nhắc)");
    expect(r).toEqual({ main: "图里的人没有马上回答，他说：“让我再____一下。”", how: "Gõ một từ tiếng Trung", meaning: "suy nghĩ, cân nhắc" });
  });
  it("ngoặc toàn chiều rộng và không có nghĩa", () => {
    expect(splitTrailingHint("他____了。（gõ một từ）")).toEqual({ main: "他____了。", how: "Gõ một từ", meaning: "" });
  });
  it("tiếng Anh: type a word", () => {
    expect(splitTrailingHint("She ______ hard. (type one word, meaning: study)")).toEqual({ main: "She ______ hard.", how: "Type one word", meaning: "study" });
  });
  it("ngoặc không phải gợi ý cách làm thì không tách", () => {
    expect(splitTrailingHint("She ______ (study) really hard.")).toBeNull();
    expect(splitTrailingHint("Câu này (xem hình 2)")).toBeNull();
    expect(splitTrailingHint("Không có ngoặc ____")).toBeNull();
  });
  it("ngoặc ở giữa câu không bị tách", () => {
    expect(splitTrailingHint("Chọn (gõ một từ) rồi điền ____.")).toBeNull();
  });
});
