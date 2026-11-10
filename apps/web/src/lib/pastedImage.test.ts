import { describe, expect, it } from "vitest";
import { pickPastedImage } from "./pastedImage";

const file = (type: string, name = "x") => new File(["a"], name, { type });

describe("pickPastedImage", () => {
  it("clipboard chỉ có ảnh PNG/JPG/WebP/GIF → nhận ảnh", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      const r = pickPastedImage({ files: [file(type)], text: "" });
      expect(r.kind, type).toBe("image");
    }
  });

  it("có chữ (kể cả chữ kèm ảnh do Word/web đính kèm) → không cướp sự kiện dán", () => {
    expect(pickPastedImage({ files: [file("image/png")], text: "Đoạn văn từ Word" }).kind).toBe("none");
    expect(pickPastedImage({ files: [file("image/png")], text: "   \n" }).kind).toBe("image"); // toàn khoảng trắng = không có chữ
  });

  it("không có ảnh (hoặc không có gì) → để trình duyệt xử lý", () => {
    expect(pickPastedImage({ files: [], text: "" }).kind).toBe("none");
    expect(pickPastedImage({ files: [file("application/pdf")], text: "" }).kind).toBe("none");
    expect(pickPastedImage({}).kind).toBe("none");
    expect(pickPastedImage({ files: null, text: null }).kind).toBe("none");
  });

  it("ảnh sai định dạng (SVG, BMP…) → báo không hỗ trợ; nhiều ảnh thì lấy ảnh đầu tiên hợp lệ", () => {
    expect(pickPastedImage({ files: [file("image/svg+xml")], text: "" })).toEqual({ kind: "unsupported", type: "image/svg+xml" });
    const good = file("image/png", "good");
    const r = pickPastedImage({ files: [file("image/bmp"), good], text: "" });
    expect(r.kind).toBe("image");
    expect(r.kind === "image" && r.file).toBe(good);
  });
});
