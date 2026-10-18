import { describe, expect, it } from "vitest";
import { DRAFTS_SCHEMA, SLIDE_SPEC, buildSlidesPrompt } from "../aiTutor/lectureSlides";
import { OUTLINE_CONTENT_LAYOUTS, buildOutlinePrompt } from "../aiTutor/lectureOutline";

// Bảng và Biểu đồ: AI chỉ được dùng khi số liệu có trong tài liệu (máy chủ kiểm lại ở limioLiveGenerate).

describe("Bảng và Biểu đồ trong lời nhắc AI", () => {
  it("dàn ý cho phép hai bố cục mới và nhắc chỉ dùng số có trong tài liệu", () => {
    expect(OUTLINE_CONTENT_LAYOUTS).toContain("table");
    expect(OUTLINE_CONTENT_LAYOUTS).toContain("chart");
    const { system } = buildOutlinePrompt({ sourceText: "x".repeat(300), minutes: 30, minSlides: 14, maxSlides: 18, interactiveEvery: 4 });
    expect(system).toMatch(/"chart".*CHỈ dùng khi các con số CÓ TRONG TÀI LIỆU/s);
    expect(system).toContain('"Nhãn: số"');
  });
  it("đặc tả trường cấm tính thêm, làm tròn, ước lượng số", () => {
    for (const k of ["table", "chart"]) expect(SLIDE_SPEC[k]).toMatch(/không tính thêm, không làm tròn lại/);
    const { user } = buildSlidesPrompt({
      sourceText: "Tỉ lệ 62% và 84%.".repeat(5),
      deckTitle: "Bài",
      outline: [{ index: 0, kind: "content", layout: "chart", title: "Tỉ lệ", points: ["Tuần 1: 62%"] }],
      batch: [0],
    });
    expect(user).toContain('bố cục "chart"');
  });
  it("lược đồ đầu ra bắt buộc có table và chart, giá trị biểu đồ là số", () => {
    const item = (DRAFTS_SCHEMA.properties.slides as any).items;
    expect(item.required).toEqual(expect.arrayContaining(["table", "chart"]));
    expect(item.properties.chart.properties.series.items.properties.values.items.type).toBe("number");
    expect(item.properties.chart.properties.type.enum).toEqual(["bar", "hbar", "line", "pie", "donut"]);
  });
});
