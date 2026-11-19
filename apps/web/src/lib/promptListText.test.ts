import { describe, expect, it } from "vitest";
import { promptListText } from "./promptListText";

describe("promptListText", () => {
  it("chữ thường giữ nguyên, không có ảnh", () => {
    expect(promptListText("1 + 1 = ?")).toEqual({ text: "1 + 1 = ?", images: 0 });
    expect(promptListText("a < b và c > d")).toEqual({ text: "a < b và c > d", images: 0 });
  });
  it("HTML có ảnh (đề nhập từ Word) rút thành chữ và đếm ảnh", () => {
    expect(promptListText('<p>Cổng &amp; parabol</p><p><img src="/api/exam-assets/a.png" alt="Hình 2"></p>')).toEqual({
      text: "Cổng & parabol",
      images: 1,
    });
  });
  it("rỗng", () => {
    expect(promptListText("")).toEqual({ text: "", images: 0 });
  });
});
