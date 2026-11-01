// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cleanNarration, convertSlide, mathToDollars, plainTitle } from "./smartdocConvert";

const THAY = { xung: "thầy", ten: "Tiến Đạt" };

describe("mathToDollars", () => {
  it("đổi \\(…\\) và \\[…\\] sang $…$ và $$…$$", () => {
    expect(mathToDollars("Ta có \\(x^2\\) và \\[y=1\\]")).toBe("Ta có $x^2$ và $$y=1$$");
  });
});

describe("plainTitle", () => {
  it("bỏ ký hiệu markdown và dấu bao công thức", () => {
    expect(plainTitle("**Hàm** \\(f(x)\\) bậc hai")).toBe("Hàm f(x) bậc hai");
  });
});

describe("cleanNarration", () => {
  it("bỏ thẻ nhịp, thay xưng hô, gộp các bước", () => {
    const out = cleanNarration(
      ["Chào {{ten}}! {{Tx}} là {{gv}}. [dừng 1] Hôm nay học xác suất. [nghĩ 3: Đoán xem?]", "Bắt đầu nhé [chỉ: bai]."],
      THAY,
    );
    expect(out).toBe("Chào em! Thầy là Tiến Đạt. Hôm nay học xác suất. Bắt đầu nhé.");
  });

  it("không để lại ký hiệu $ trong chữ đọc", () => {
    expect(cleanNarration(["Công thức \\(x^2\\) nhé"], THAY)).toBe("Công thức x^2 nhé");
  });
});

describe("convertSlide", () => {
  const html =
    '<section class="hai-cot"><h2>Phép thử</h2><div class="dinh-nghia"><b>Không gian mẫu</b>: tập kết quả \\(\\Omega\\).</div>' +
    '<ul><li>Tung đồng xu: \\(n=2\\)</li></ul>' +
    '<div class="trac-nghiem"><p class="cau">Mấy kết quả?</p><button class="lc">\\(2\\)</button><button class="lc dung">\\(4\\)</button>' +
    '<div class="giai-thich">Bốn kết quả.</div></div><svg><circle/></svg><button>Bấm</button></section>';

  it("slide thành một mục: tiêu đề tách riêng, định nghĩa thành trích dẫn, trắc nghiệm thành đáp án tĩnh", () => {
    const c = convertSlide({ id: "s1", html, loiGiang: { buoc: ["Xin chào {{ten}}."] } }, THAY, "Phần 1");
    expect(c.title).toBe("Phép thử");
    expect(c.markdown).toContain("> **Không gian mẫu**: tập kết quả $\\Omega$.");
    expect(c.markdown).toContain("- Tung đồng xu: $n=2$");
    expect(c.markdown).toContain("> **Đáp án:** $4$ — Bốn kết quả.");
    expect(c.markdown).not.toContain("Bấm");
    expect(c.figures).toBe(1);
    expect(c.narration).toBe("Xin chào em.");
  });

  it("slide bìa được nhận ra, slide không có tiêu đề dùng tiêu đề dự phòng", () => {
    expect(convertSlide({ id: "b", html: '<section class="bia"><h1>Bài</h1></section>' }, THAY, "Phần 1").isCover).toBe(true);
    expect(convertSlide({ id: "x", html: "<section><p>Chỉ có chữ</p></section>" }, THAY, "Phần 7").title).toBe("Phần 7");
  });
});
