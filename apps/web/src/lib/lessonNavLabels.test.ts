import { describe, expect, it } from "vitest";
import { navSub, nextHeadline, shortTitle, unitShort } from "./lessonNavLabels";

describe("unitShort", () => {
  it("lấy phần trước dấu ngăn", () => {
    expect(unitShort("Chủ đề 2 · 退货这件事 — Mua sắm trực tuyến và trả hàng")).toBe("Chủ đề 2");
    expect(unitShort("Unit 1 · Lifestyles")).toBe("Unit 1");
    expect(unitShort("Module A — Mở đầu")).toBe("Module A");
  });
  it("không có dấu ngăn thì giữ nguyên", () => {
    expect(unitShort("Giới thiệu")).toBe("Giới thiệu");
    expect(unitShort("Gói cơ bản")).toBe("Gói cơ bản");
  });
});

describe("navSub / nextHeadline", () => {
  const same = { title: "Bài khoá 2", unitTitle: "Chủ đề 2 · x", sameUnit: true };
  const other = { title: "Bài tập tổng hợp · 综合练习", unitTitle: "Chủ đề 1 · 搬进新家", sameUnit: false };
  it("cùng unit: chỉ tên bài; khác unit: kèm tên ngắn của unit", () => {
    expect(navSub(same)).toBe("Bài khoá 2");
    expect(navSub(other)).toBe("Chủ đề 1 · Bài tập tổng hợp · 综合练习");
  });
  it("cắt gọn tên dài", () => {
    expect(navSub({ ...same, title: "x".repeat(60) }, 10)).toBe(`${"x".repeat(9)}…`);
    expect(shortTitle("ngắn")).toBe("ngắn");
  });
  it("dòng trên của 'Tiếp': nhãn thường trong unit, tên unit khi sang unit khác", () => {
    expect(nextHeadline(same, "Bài tiếp theo")).toBe("Bài tiếp theo");
    expect(nextHeadline({ ...other, unitTitle: "Chủ đề 3 · y" }, "Bài tiếp theo")).toBe("Chủ đề 3");
  });
});
