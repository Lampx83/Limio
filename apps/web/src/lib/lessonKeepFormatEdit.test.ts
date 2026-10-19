// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { blockToText, candidateBlocks, headingBefore, replaceBlock } from "./lessonKeepFormatEdit";

const HTML =
  "<h2>Mục một</h2><p>Câu <strong>đậm</strong> và <em>nghiêng</em>.</p><ul><li><p>Ý trong danh sách.</p></li><li>Ý trần.</li></ul>" +
  '<p>Có <a href="https://a.vn">liên kết</a>.</p><table><tbody><tr><td>ô</td></tr></tbody></table>';

function root(html = HTML) {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

describe("đoạn có thể nhờ AI", () => {
  it("liệt kê p và li (li chứa p thì tính p), theo thứ tự tài liệu", () => {
    const texts = candidateBlocks(root()).map((e) => (e.textContent ?? "").trim());
    expect(texts).toEqual(["Câu đậm và nghiêng.", "Ý trong danh sách.", "Ý trần.", "Có liên kết."]);
  });

  it("chữ có ** và *, đoạn có liên kết thì null", () => {
    const blocks = candidateBlocks(root());
    expect(blockToText(blocks[0]!)).toBe("Câu **đậm** và *nghiêng*.");
    expect(blockToText(blocks[3]!)).toBeNull();
  });

  it("tiêu đề gần nhất phía trên", () => {
    const r = root();
    expect(headingBefore(candidateBlocks(r)[1]!, r)).toBe("Mục một");
  });
});

describe("replaceBlock", () => {
  it("thay chữ đoạn, giữ phần còn lại", () => {
    const out = replaceBlock(HTML, 0, "Câu **đậm** và *nghiêng*.", "Câu mới **đậm**.")!;
    expect(out).toContain("<p>Câu mới <strong>đậm</strong>.</p>");
    expect(out).toContain("<h2>Mục một</h2>");
    expect(out).toContain("<table>");
  });

  it("thêm ví dụ sau đoạn kèm nhãn AI gợi ý", () => {
    const out = replaceBlock(HTML, 0, "Câu **đậm** và *nghiêng*.", "Câu **đậm** và *nghiêng*.", "Ví dụ cụ thể.")!;
    expect(out).toContain("</p><p><strong>Ví dụ (AI gợi ý):</strong> Ví dụ cụ thể.</p>");
  });

  it("chữ trên màn hình lệch bản lưu thì không sửa", () => {
    expect(replaceBlock(HTML, 0, "Chữ khác", "x")).toBeNull();
    expect(replaceBlock(HTML, 99, "x", "y")).toBeNull();
  });

  it("thoát HTML trong chữ AI trả về", () => {
    const out = replaceBlock(HTML, 2, "Ý trần.", "<img src=x onerror=1> an toàn")!;
    expect(out).not.toContain("<img");
  });
});
