import { describe, expect, it } from "vitest";
import { PASTE_AS_DOC_CHARS, canSubmitCreate, classifyUpload, handOffPptx, pasteAsDocument, takeHandedOffPptx } from "./limioLiveCreateSource";

/** Trang Tạo bài giảng một ô — docs/tieu-chi/tao-bai-giang-mot-o.md (M3–M7, M21). */

describe("classifyUpload (M3)", () => {
  it("nhận ra PowerPoint mới và cũ, không phân biệt hoa thường", () => {
    expect(classifyUpload("Bai-giang.pptx")).toBe("pptx");
    expect(classifyUpload("BAI GIANG.PPTX")).toBe("pptx");
    expect(classifyUpload("cu.ppt")).toBe("legacy_ppt");
  });
  it("tài liệu AI đọc được", () => {
    for (const n of ["a.docx", "b.PDF", "c.txt", "d.md"]) expect(classifyUpload(n)).toBe("doc");
  });
  it("loại khác không nhận", () => {
    for (const n of ["a.doc", "b.xlsx", "c.key", "noext", "anh.png"]) expect(classifyUpload(n)).toBe("unsupported");
  });
});

describe("dán văn bản dài thành tài liệu (M4)", () => {
  it("đoạn dán trên 2.000 ký tự khi chưa có tệp thì thành tài liệu", () => {
    expect(PASTE_AS_DOC_CHARS).toBe(2000);
    expect(pasteAsDocument("x".repeat(2001), false)).toBe(true);
    expect(pasteAsDocument("x".repeat(2000), false)).toBe(false);
  });
  it("đã có tài liệu thì không chuyển", () => {
    expect(pasteAsDocument("x".repeat(5000), true)).toBe(false);
  });
  it("khoảng trắng không tính", () => {
    expect(pasteAsDocument(`  ${"x".repeat(1990)}\n\n\n\n\n\n\n\n\n\n\n\n  `, false)).toBe(false);
  });
});

describe("canSubmitCreate (M6)", () => {
  it("không tài liệu: mô tả cần ít nhất 15 ký tự", () => {
    expect(canSubmitCreate({ description: "  ngắn  ", hasAttachment: false })).toBe(false);
    expect(canSubmitCreate({ description: "Bài về thực tế tăng cường", hasAttachment: false })).toBe(true);
  });
  it("có tài liệu: mô tả không bắt buộc", () => {
    expect(canSubmitCreate({ description: "", hasAttachment: true })).toBe(true);
  });
  it("mô tả quá 2.000 ký tự thì không gửi", () => {
    expect(canSubmitCreate({ description: "x".repeat(2001), hasAttachment: true })).toBe(false);
  });
});

describe("chuyển tệp PowerPoint sang trang nhập, mang theo mô tả (M7)", () => {
  it("lấy được đúng một lần, kèm mô tả", () => {
    const f = new File(["x"], "Bai.pptx");
    handOffPptx(f, "Dạy cho sinh viên năm nhất.");
    expect(takeHandedOffPptx()).toEqual({ file: f, intent: "Dạy cho sinh viên năm nhất." });
    expect(takeHandedOffPptx()).toBeNull();
  });
  it("không mô tả thì intent rỗng; chưa chuyển gì thì null", () => {
    const f = new File(["x"], "Bai.pptx");
    handOffPptx(f);
    expect(takeHandedOffPptx()).toEqual({ file: f, intent: "" });
    expect(takeHandedOffPptx()).toBeNull();
  });
});
