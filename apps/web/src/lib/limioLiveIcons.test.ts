import { describe, expect, it } from "vitest";
import { SLIDE_ICONS, autoGroupIcons, iconForText } from "./limioLiveIcons";

describe("bộ biểu tượng (P60)", () => {
  it("16 biểu tượng, không trùng, giữ nguyên 8 biểu tượng cũ ở đầu", () => {
    expect(SLIDE_ICONS).toHaveLength(16);
    expect(new Set(SLIDE_ICONS).size).toBe(16);
    expect(SLIDE_ICONS.slice(0, 8)).toEqual(["target", "compass", "route", "chat", "book", "sparkle", "users", "chart"]);
  });
});

describe("iconForText: từ khoá tự chọn biểu tượng (P61)", () => {
  it.each([
    ["Đạo đức & Trách nhiệm số", "shield"],
    ["Đánh giá & kiểm chứng AI", "search"],
    ["AI Literacy", "book"],
    ["Sử dụng AI chuyên môn", "sparkle"],
    ["Thiết kế đánh giá trong bối cảnh AI", "chart"],
    ["Ethics and privacy", "shield"],
    ["Research methods", "search"],
    ["Quy trình triển khai", "route"],
    ["Positive attitude", "heart"],
    ["Giáo dục STEM", "cap"],
  ])("%s → %s", (text, icon) => {
    expect(iconForText(text)[0]).toBe(icon);
  });
  it("không có từ khoá thì không có biểu tượng", () => {
    expect(iconForText("Bản chất")).toEqual([]);
    expect(iconForText("")).toEqual([]);
  });
  it("không khớp giữa chữ (ai trong 'mail', 'aim')", () => {
    expect(iconForText("Gửi mail")).toEqual([]);
  });
});

describe("autoGroupIcons (P61)", () => {
  const g = (heading: string, ...points: string[]) => ({ heading, points });
  it("theo tên nhóm, rồi theo ý con", () => {
    const r = autoGroupIcons([g("Đạo đức số", "x"), g("Bản chất", "Hiểu dữ liệu và phân tích"), g("Linh tinh", "y")]);
    expect(r[0]).toBe("shield");
    expect(r[1]).toBe("chart");
    expect(SLIDE_ICONS).toContain(r[2]);
  });
  it("hai nhóm cùng slide không trùng biểu tượng", () => {
    const r = autoGroupIcons([g("Đánh giá một"), g("Đánh giá hai"), g("Đánh giá ba")]);
    expect(new Set(r).size).toBe(3);
  });
  it("biểu tượng giảng viên chọn tay luôn thắng và không bị nhóm khác lấy lại", () => {
    const r = autoGroupIcons([{ ...g("Bản chất"), icon: "chart" }, g("Phân tích dữ liệu")]);
    expect(r[0]).toBe("chart");
    expect(r[1]).not.toBe("chart");
  });
  it("tối đa 6 nhóm đều có biểu tượng khác nhau", () => {
    const r = autoGroupIcons(Array.from({ length: 6 }, (_, i) => g(`Nhóm ${i}`)));
    expect(new Set(r).size).toBe(6);
  });
});
