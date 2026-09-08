import { describe, expect, it } from "vitest";
import { slugifyHeadingText, uniqueHeadingId } from "./headingId";

describe("slugifyHeadingText", () => {
  it("bỏ dấu tiếng Việt, thường hoá, thay khoảng trắng bằng gạch ngang", () => {
    expect(slugifyHeadingText("Giới thiệu về UX")).toBe("muc-gioi-thieu-ve-ux");
  });

  it("xử lý đúng chữ đ/Đ (không phải diacritic NFD thông thường)", () => {
    expect(slugifyHeadingText("Điều kiện tiên quyết")).toBe("muc-dieu-kien-tien-quyet");
  });

  it("bỏ ký tự không phải a-z0-9, không để gạch ngang ở đầu/cuối", () => {
    expect(slugifyHeadingText("  Bước 1: Cài đặt!!  ")).toBe("muc-buoc-1-cai-dat");
  });

  it("chuỗi rỗng sau khi lọc → fallback 'phan'", () => {
    expect(slugifyHeadingText("???")).toBe("muc-phan");
  });
});

describe("uniqueHeadingId", () => {
  it("trả về nguyên id nếu chưa dùng", () => {
    expect(uniqueHeadingId("muc-a", new Set())).toBe("muc-a");
  });

  it("thêm hậu tố -2 nếu id đã dùng", () => {
    expect(uniqueHeadingId("muc-a", new Set(["muc-a"]))).toBe("muc-a-2");
  });

  it("tăng dần hậu tố cho tới khi tìm được id trống", () => {
    expect(uniqueHeadingId("muc-a", new Set(["muc-a", "muc-a-2", "muc-a-3"]))).toBe("muc-a-4");
  });
});
