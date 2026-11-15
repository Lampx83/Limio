import { describe, expect, it } from "vitest";
import { parsePromptAid } from "./promptAid";

describe("parsePromptAid", () => {
  it("đọc phiên âm và bản dịch, cắt khoảng trắng", () => {
    expect(parsePromptAid({ promptAid: { reading: " Nǐ hǎo? ", translation: "Hello?" } })).toEqual({ reading: "Nǐ hǎo?", translation: "Hello?" });
  });
  it("chỉ có một trong hai vẫn dùng được", () => {
    expect(parsePromptAid({ promptAid: { reading: "Nǐ hǎo?" } })).toEqual({ reading: "Nǐ hǎo?" });
  });
  it("thiếu, rỗng hoặc sai dạng thì null", () => {
    expect(parsePromptAid(null)).toBeNull();
    expect(parsePromptAid({})).toBeNull();
    expect(parsePromptAid({ promptAid: "x" })).toBeNull();
    expect(parsePromptAid({ promptAid: { reading: " ", translation: 3 } })).toBeNull();
  });
});
