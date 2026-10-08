import { describe, it, expect } from "vitest";
import { toPlainText } from "../aiTutor/plainText";

describe("toPlainText — bỏ ký hiệu markdown/code khỏi chữ LLM sinh", () => {
  it("bỏ đậm, nghiêng, code nội dòng, tiêu đề", () => {
    expect(toPlainText("### Nhận xét\nBài **rất tốt**, dùng `for` đúng và *gọn*.")).toBe(
      "Nhận xét\nBài rất tốt, dùng for đúng và gọn.",
    );
  });

  it("gạch đầu dòng → •, link giữ chữ, khối code giữ nội dung", () => {
    expect(toPlainText("- Ý một\n* Ý hai\n[xem thêm](https://x.y)\n```js\nlet a = 1;\n```")).toBe(
      "• Ý một\n• Ý hai\nxem thêm\nlet a = 1;",
    );
  });

  it("\\n literal thành xuống dòng thật; bỏ khối <think>", () => {
    expect(toPlainText("<think>nghĩ...</think>Dòng 1\\nDòng 2")).toBe("Dòng 1\nDòng 2");
  });

  it("dấu lẻ còn sót bị dọn; không đụng dấu nhân trong công thức", () => {
    expect(toPlainText("Điểm **cao")).toBe("Điểm cao");
    expect(toPlainText("Tính 3 * 4 = 12")).toBe("Tính 3 * 4 = 12");
  });

  it("rỗng/null → chuỗi rỗng", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
  });
});
