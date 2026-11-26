import { describe, expect, it } from "vitest";
import { mergePinyinColumn, rubyHtml } from "./tablePinyin";

const table = (rows: string[][]) =>
  `<table><thead><tr>${rows[0]!.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows
    .slice(1)
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

describe("rubyHtml", () => {
  it("mỗi chữ Hán một ruby kèm âm tiết, dấu câu giữ nguyên", () => {
    const h = rubyHtml("按时交。", "ànshí jiāo.")!;
    expect((h.match(/<ruby/g) ?? []).length).toBe(4 - 1); // 按 时 交 (dấu 。không có ruby)
    expect(h).toContain("<rt>àn</rt>");
    expect(h).toContain("。");
  });
  it("pinyin không khớp số chữ Hán thì null", () => {
    expect(rubyHtml("按时交", "àn")).toBeNull();
  });
});

describe("mergePinyinColumn", () => {
  it("bảng Câu | Pinyin | Nghĩa chỉ còn hai cột, pinyin thành ruby dưới chữ Hán", () => {
    const out = mergePinyinColumn(table([["Câu", "Pinyin", "Nghĩa"], ["请按时交。", "Qǐng ànshí jiāo.", "Mời nộp đúng hạn."]]));
    expect(out).not.toContain("Pinyin");
    expect(out).not.toContain("Qǐng ànshí jiāo.");
    expect(out).toContain("<rt>qǐng</rt>"); // ruby dùng âm tiết viết thường
    expect((out.match(/<th>/g) ?? []).length).toBe(2);
    expect((out.match(/<td>/g) ?? []).length).toBe(2);
    expect(out).toContain("Mời nộp đúng hạn.");
  });
  it("hàng ghép không khớp: giữ pinyin thành dòng nhỏ dưới câu, không mất chữ", () => {
    const out = mergePinyinColumn(table([["Câu", "Pinyin", "Nghĩa"], ["请按时交。", "sai so am tiet", "x"]]));
    expect(out).toContain("sai so am tiet");
    expect(out).toContain("py-latin");
  });
  it("bảng khác (không có cột Pinyin) giữ nguyên", () => {
    const t = table([["Từ", "Nghĩa và cách dùng"], ["按时", "đúng hạn"]]);
    expect(mergePinyinColumn(t)).toBe(t);
  });
});
