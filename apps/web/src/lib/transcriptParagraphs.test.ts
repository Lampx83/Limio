import { describe, expect, it } from "vitest";
import { paragraphMarker, splitTranscriptParagraphs } from "./transcriptParagraphs";

describe("splitTranscriptParagraphs", () => {
  it("tách theo dòng trống, giữ xuống dòng đơn trong cùng đoạn, bỏ đoạn rỗng", () => {
    expect(splitTranscriptParagraphs("A: xin chào\nB: chào bạn\n\n\n  \nĐoạn hai\r\n\r\nĐoạn ba  ")).toEqual([
      "A: xin chào\nB: chào bạn",
      "Đoạn hai",
      "Đoạn ba",
    ]);
  });
  it("không có dòng trống thì một đoạn; rỗng thì không có đoạn", () => {
    expect(splitTranscriptParagraphs("một đoạn\nhai dòng")).toHaveLength(1);
    expect(splitTranscriptParagraphs("   \n\n  ")).toEqual([]);
  });
});

describe("paragraphMarker", () => {
  it("dùng số khoanh tròn tới 20, sau đó dùng số thường", () => {
    expect(paragraphMarker(1)).toBe("①");
    expect(paragraphMarker(2)).toBe("②");
    expect(paragraphMarker(20)).toBe("⑳");
    expect(paragraphMarker(21)).toBe("21.");
    expect(paragraphMarker(0)).toBe("0.");
  });
});
