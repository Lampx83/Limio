import { describe, expect, it } from "vitest";
import { CREATE_SOURCES, canSubmitSource, classifyUpload, handOffPptx, takeHandedOffPptx } from "./limioLiveCreateSource";

/** Trang Tạo bài giảng chọn nguồn bằng ba thẻ — docs/tieu-chi/tao-bai-giang-ba-the.md (N1, N7, N9–N11, N14). */

describe("ba thẻ nguồn (N1)", () => {
  it("đúng thứ tự, đúng tên, thẻ đầu là ý tưởng", () => {
    expect(CREATE_SOURCES.map((s) => s.id)).toEqual(["idea", "doc", "pptx"]);
    expect(CREATE_SOURCES.map((s) => s.label)).toEqual(["Từ ý tưởng", "Từ tài liệu", "Từ bài PowerPoint"]);
    for (const s of CREATE_SOURCES) expect(s.hint.length).toBeGreaterThan(10);
  });
});

describe("classifyUpload (N10, N11)", () => {
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

describe("canSubmitSource (N7)", () => {
  const empty = { topic: "", text: "", hasFile: false };
  it("ý tưởng cần ít nhất 15 ký tự sau khi bỏ khoảng trắng", () => {
    expect(canSubmitSource("idea", { ...empty, topic: "   ngắn    " })).toBe(false);
    expect(canSubmitSource("idea", { ...empty, topic: "Bài về thực tế tăng cường" })).toBe(true);
  });
  it("tài liệu cần tệp hoặc chữ dán vào", () => {
    expect(canSubmitSource("doc", empty)).toBe(false);
    expect(canSubmitSource("doc", { ...empty, text: "   " })).toBe(false);
    expect(canSubmitSource("doc", { ...empty, text: "Chương 3" })).toBe(true);
    expect(canSubmitSource("doc", { ...empty, hasFile: true })).toBe(true);
  });
  it("chữ ở thẻ khác không làm bật nút", () => {
    expect(canSubmitSource("doc", { ...empty, topic: "Bài về thực tế tăng cường" })).toBe(false);
    expect(canSubmitSource("idea", { ...empty, text: "Chương 3 rất dài", hasFile: true })).toBe(false);
  });
  it("thẻ PowerPoint không dùng nút Soạn dàn ý", () => {
    expect(canSubmitSource("pptx", { topic: "Bài về thực tế tăng cường", text: "x", hasFile: true })).toBe(false);
  });
});

describe("chuyển tệp PowerPoint sang trang nhập (N9)", () => {
  it("lấy được đúng một lần", () => {
    const f = new File(["x"], "Bai.pptx");
    handOffPptx(f);
    expect(takeHandedOffPptx()).toBe(f);
    expect(takeHandedOffPptx()).toBeNull();
  });
  it("chưa chuyển gì thì trả null", () => {
    expect(takeHandedOffPptx()).toBeNull();
  });
});
