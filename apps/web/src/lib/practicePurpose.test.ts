import { describe, expect, it } from "vitest";
import { PRACTICE_PURPOSES, practicePurposeChipStyle, practicePurposeOf } from "./practicePurpose";

describe("practicePurposeOf — mục đích của khối luyện theo tên", () => {
  it("tên theo quy ước: tách mục đích và phần tên", () => {
    expect(practicePurposeOf("Ngữ pháp · 按时、赶紧、本来、忽然")).toMatchObject({ purpose: { key: "grammar", label: "Ngữ pháp" }, text: "按时、赶紧、本来、忽然" });
    expect(practicePurposeOf("Hiểu hội thoại · Nghe lại và trả lời")).toMatchObject({ purpose: { key: "dialogue" }, text: "Nghe lại và trả lời" });
    expect(practicePurposeOf("Nói · Đóng vai và nói với bạn ảo")?.purpose.key).toBe("speaking");
    expect(practicePurposeOf("Viết · Viết ngắn")?.purpose.key).toBe("writing");
    expect(practicePurposeOf("Nói và viết · Đóng vai, nói tự do và viết ngắn")?.purpose.key).toBe("speakwrite");
  });

  it("tên thường gặp ở Bài tập tổng hợp được nhận và bỏ tiền tố", () => {
    expect(practicePurposeOf("Luyện nói · Hỏi thuê nhà")).toMatchObject({ purpose: { key: "speaking" }, text: "Hỏi thuê nhà" });
    expect(practicePurposeOf("Đọc hiểu · Nhật ký của Lâm Vũ")).toMatchObject({ purpose: { key: "reading" }, text: "Nhật ký của Lâm Vũ" });
  });

  it("tên không theo quy ước, tên không có phần sau dấu · hoặc rỗng thì không có mục đích", () => {
    expect(practicePurposeOf("课文2 · Nối từ")).toBeNull();
    expect(practicePurposeOf("Phần 1 · Nghe (12 câu, 10 phút)")).toBeNull();
    expect(practicePurposeOf("Từ vựng")).toBeNull();
    expect(practicePurposeOf("Từ vựng · ")).toBeNull();
    expect(practicePurposeOf("")).toBeNull();
    expect(practicePurposeOf(undefined)).toBeNull();
  });

  it("mỗi mục đích có màu chữ sáng/tối và chip dùng light-dark()", () => {
    for (const p of Object.values(PRACTICE_PURPOSES)) {
      expect(p.fg).toHaveLength(2);
      expect(practicePurposeChipStyle(p).color).toBe(`light-dark(${p.fg[0]}, ${p.fg[1]})`);
    }
  });
});
