import { describe, expect, it } from "vitest";
import { locateQuote } from "./annotationAnchor";

const text = "Ví dụ một. Ví dụ hai. Ví dụ ba, và đây là đoạn cần ghi chú.";

describe("locateQuote", () => {
  it("giữ offset cũ khi văn bản không đổi", () => {
    const start = text.indexOf("đoạn cần");
    expect(
      locateQuote(text, { quote: "đoạn cần", prefix: "đây là ", suffix: " ghi chú.", startOffset: start }),
    ).toBe(start);
  });

  it("tìm lại khi chèn chữ phía trước làm offset lệch", () => {
    const edited = "LỜI MỞ ĐẦU MỚI. " + text;
    const old = text.indexOf("đoạn cần");
    const found = locateQuote(edited, {
      quote: "đoạn cần",
      prefix: "đây là ",
      suffix: " ghi chú.",
      startOffset: old,
    });
    expect(found).toBe(edited.indexOf("đoạn cần"));
  });

  it("nhiều chỗ khớp thì chọn chỗ có ngữ cảnh giống nhất", () => {
    // Annotation gốc ở "Ví dụ hai": prefix "một. ", suffix " hai."? — dùng ngữ cảnh thật.
    const t = "Ví dụ một. Ví dụ hai. Ví dụ ba.";
    const second = t.indexOf("Ví dụ", 5);
    const edited = "Thêm. " + t;
    const found = locateQuote(edited, {
      quote: "Ví dụ",
      prefix: "Ví dụ một. ",
      suffix: " hai. Ví dụ ba.",
      startOffset: second,
    });
    expect(found).toBe(edited.indexOf("Ví dụ", edited.indexOf("một.")));
  });

  it("hoà điểm ngữ cảnh thì chọn chỗ gần offset cũ", () => {
    const t = "abc abc abc";
    expect(locateQuote(t, { quote: "abc", prefix: "", suffix: "", startOffset: 8 })).toBe(8);
    expect(locateQuote(t, { quote: "abc", prefix: "", suffix: "", startOffset: 0 })).toBe(0);
  });

  it("đoạn trích biến mất thì trả null (mồ côi)", () => {
    expect(locateQuote("hoàn toàn khác", { quote: "đoạn cần", prefix: "", suffix: "", startOffset: 3 })).toBeNull();
  });

  it("quote rỗng thì trả null", () => {
    expect(locateQuote(text, { quote: "", prefix: "", suffix: "", startOffset: 0 })).toBeNull();
  });
});
