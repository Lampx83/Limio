import { describe, expect, it } from "vitest";
import { SOURCE_MAX_PARAS, htmlToParas, textToParas, wordCount } from "./lessonSource";

describe("tách tài liệu thành đoạn", () => {
  it("văn bản dán: mỗi dòng có chữ là một đoạn, bỏ dòng trống và dấu Markdown", () => {
    const paras = textToParas("# Tiêu đề\n\nĐoạn một.\n\n- Ý thứ nhất\n> Trích dẫn\n");
    expect(paras).toEqual([{ t: "Tiêu đề" }, { t: "Đoạn một." }, { t: "- Ý thứ nhất" }, { t: "Trích dẫn" }]);
  });

  it("PDF: nối dòng bị ngắt giữa câu, giữ gạch đầu dòng và tiêu đề viết hoa, bỏ số trang", () => {
    const pdf = [
      "NGUYÊN TẮC GẦN NHAU",
      "Mắt người có xu hướng xem các phần tử đặt",
      "gần nhau là thuộc cùng một nhóm.",
      "12",
      "- Khoảng trắng là công cụ.",
      "Từ bị gạch nối cuối dòng như thiết-",
      "kế vẫn được ghép lại.",
    ].join("\n");
    expect(textToParas(pdf, { reflow: true })).toEqual([
      { t: "NGUYÊN TẮC GẦN NHAU" },
      { t: "Mắt người có xu hướng xem các phần tử đặt gần nhau là thuộc cùng một nhóm." },
      { t: "- Khoảng trắng là công cụ." },
      { t: "Từ bị gạch nối cuối dòng như thiếtkế vẫn được ghép lại." },
    ]);
  });

  it("Word (HTML của mammoth): khối thành đoạn, ảnh thành đoạn riêng đúng vị trí", () => {
    const html =
      "<h1>Bài 2.3</h1><p>Mở đầu &amp; giới thiệu.</p>" +
      '<p>Trước ảnh <img src="/api/lesson-media/images/a.png" alt="Hình &quot;A&quot;" /> sau ảnh</p>' +
      "<ul><li>Ý một</li><li>Ý hai</li></ul>" +
      "<table><tr><td>Cột 1</td><td>Cột 2</td></tr></table>";
    expect(htmlToParas(html)).toEqual([
      { t: "Bài 2.3" },
      { t: "Mở đầu & giới thiệu." },
      { t: "Trước ảnh" },
      { img: "/api/lesson-media/images/a.png", alt: 'Hình "A"' },
      { t: "sau ảnh" },
      { t: "Ý một" },
      { t: "Ý hai" },
      { t: "Cột 1 | Cột 2" },
    ]);
  });

  it("bảng Word (chữ trong ô bọc <p>): mỗi hàng là một đoạn", () => {
    const html =
      "<table><tr><td><p>Phiếu</p></td><td><p>Nội dung</p><p>dòng hai</p></td></tr>" +
      "<tr><td><p>1</p></td><td><p>Quan sát</p></td></tr></table>";
    expect(htmlToParas(html)).toEqual([{ t: "Phiếu | Nội dung dòng hai" }, { t: "1 | Quan sát" }]);
  });

  it("ảnh không có src (định dạng không hỗ trợ) bị bỏ, không sinh đoạn rỗng", () => {
    expect(htmlToParas('<p><img src="" alt="x"/></p><p>Chữ</p>')).toEqual([{ t: "Chữ" }]);
  });

  it("đoạn quá dài được cắt ở ranh giới câu; tài liệu quá lớn bị chặn ở trần", () => {
    const long = Array.from({ length: 60 }, (_, i) => `Câu thứ ${i} khá dài để vượt giới hạn của một đoạn văn.`).join(" ");
    const paras = textToParas(long);
    expect(paras.length).toBeGreaterThan(1);
    for (const p of paras) expect("t" in p && p.t.length <= 2000).toBe(true);
    expect(textToParas(Array.from({ length: 2000 }, (_, i) => `Dòng ${i}`).join("\n")).length).toBe(SOURCE_MAX_PARAS);
  });

  it("đếm từ chỉ tính phần chữ", () => {
    expect(wordCount([{ t: "Một hai ba" }, { img: "/a.png", alt: "x y" }, { t: "bốn" }])).toBe(4);
  });
});
