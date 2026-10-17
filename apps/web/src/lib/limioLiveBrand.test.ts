import { describe, expect, it } from "vitest";
import {
  BRAND_POSITIONS,
  BRAND_SHOWS,
  BRAND_SIZES,
  MIN_CONTRAST,
  brandCssVars,
  brandLogoFilename,
  brandPalette,
  contentScaleForLogo,
  contrastRatio,
  logoPlacement,
  logoRoomPx,
  logoVisibleOn,
  sanitizeBrand,
  slideRole,
  validateBrandInput,
} from "./limioLiveBrand";

const LOGO = "/api/limio-live-media/abc123-1.png";

describe("sanitizeBrand", () => {
  it("không có logo và không có màu thì coi như chưa đặt thương hiệu", () => {
    expect(sanitizeBrand(null)).toBeNull();
    expect(sanitizeBrand("x")).toBeNull();
    expect(sanitizeBrand({})).toBeNull();
    expect(sanitizeBrand({ logoPos: "tl" })).toBeNull();
  });
  it("giữ giá trị hợp lệ, mã màu viết hoa, giá trị lạ về mặc định", () => {
    expect(sanitizeBrand({ logoUrl: LOGO, color: "#0a6ebd", logoPos: "bl", logoSize: "l", logoShow: "ends" })).toEqual({
      logoUrl: LOGO, color: "#0A6EBD", logoPos: "bl", logoSize: "l", logoShow: "ends",
    });
    expect(sanitizeBrand({ color: "#0A6EBD", logoPos: "giữa", logoSize: "xl", logoShow: "không" })).toEqual({
      color: "#0A6EBD", logoPos: "tr", logoSize: "m", logoShow: "all",
    });
  });
  it("bỏ địa chỉ logo ngoài thư mục tải lên của Limio-Live và mã màu sai", () => {
    expect(sanitizeBrand({ logoUrl: "https://evil.example/x.png", color: "đỏ" })).toBeNull();
    expect(sanitizeBrand({ logoUrl: "/api/limio-live-media/../../etc/passwd" })).toBeNull();
    expect(sanitizeBrand({ logoUrl: "javascript:alert(1)", color: "#12345" })).toBeNull();
    expect(sanitizeBrand({ logoUrl: LOGO, color: "#GGGGGG" })).toMatchObject({ logoUrl: LOGO });
    expect(sanitizeBrand({ logoUrl: LOGO, color: "#GGGGGG" })).not.toHaveProperty("color");
  });
});

describe("validateBrandInput (API lưu)", () => {
  it("null là xoá thương hiệu", () => expect(validateBrandInput(null)).toEqual({ ok: true, brand: null }));
  it("từ chối giá trị sai thay vì lẳng lặng bỏ", () => {
    expect(validateBrandInput(5)).toEqual({ ok: false, error: "invalid_brand" });
    expect(validateBrandInput({ color: "đỏ" })).toEqual({ ok: false, error: "invalid_color" });
    expect(validateBrandInput({ logoUrl: "https://x/y.png" })).toEqual({ ok: false, error: "invalid_logo_url" });
    expect(validateBrandInput({ logoUrl: LOGO, logoPos: "giữa" })).toEqual({ ok: false, error: "invalid_logoPos" });
    expect(validateBrandInput({ logoUrl: LOGO, logoSize: "xl" })).toEqual({ ok: false, error: "invalid_logoSize" });
    expect(validateBrandInput({ logoUrl: LOGO, logoShow: "x" })).toEqual({ ok: false, error: "invalid_logoShow" });
  });
  it("nhận dữ liệu đúng; màu rỗng nghĩa là bỏ màu; hết logo và màu thì thành null", () => {
    expect(validateBrandInput({ logoUrl: LOGO, color: "" })).toMatchObject({ ok: true, brand: { logoUrl: LOGO } });
    expect(validateBrandInput({ color: "" })).toEqual({ ok: true, brand: null });
    expect(validateBrandInput({ color: "#0A6EBD", logoPos: "br" })).toMatchObject({ ok: true, brand: { color: "#0A6EBD", logoPos: "br" } });
  });
});

describe("brandPalette", () => {
  it("màu không hợp lệ cho null", () => {
    expect(brandPalette("đỏ", false)).toBeNull();
    expect(brandPalette("#12", false)).toBeNull();
  });
  it("màu vừa đủ tương phản thì giữ nguyên", () => {
    const p = brandPalette("#0A6EBD", false)!;
    expect(p.sa).toBe("#0A6EBD");
    expect(p.adjusted).toBe(false);
  });
  it("màu quá nhạt trên nền sáng được làm đậm tới khi chữ đủ rõ", () => {
    const p = brandPalette("#F5C518", false)!;
    expect(p.adjusted).toBe(true);
    expect(contrastRatio(p.sa, "#FFFFFF")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
  it("màu quá tối trên nền tối được làm sáng tới khi đủ rõ", () => {
    const p = brandPalette("#1E3A8A", true)!;
    expect(p.adjusted).toBe(true);
    expect(contrastRatio(p.sa, "#0B1020")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
  it("mọi màu thử đều đạt độ tương phản tối thiểu ở cả hai nền", () => {
    for (const c of ["#0A6EBD", "#B91C1C", "#0F766E", "#7C3AED", "#C2410C", "#F5C518", "#FFFFFF", "#000000", "#00FF00", "#808080"]) {
      expect(contrastRatio(brandPalette(c, false)!.sa, "#FFFFFF"), `${c} nền sáng`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(brandPalette(c, true)!.sa, "#0B1020"), `${c} nền tối`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
  it("nền tối dùng nền thẻ trong suốt; chữ trên nút chọn đen hoặc trắng theo độ sáng", () => {
    expect(brandPalette("#0A6EBD", true)!.soft).toContain("rgba");
    expect(brandPalette("#0A6EBD", false)!.soft).toMatch(/^#/);
    expect(["#FFFFFF", "#111111"]).toContain(brandPalette("#F5C518", true)!.on);
  });
});

describe("brandCssVars", () => {
  it("không có màu thì không ghi đè gì", () => {
    expect(brandCssVars(undefined, false)).toEqual({});
    expect(brandCssVars("hỏng", false)).toEqual({});
  });
  it("ghi đè đủ các biến màu nhấn của giao diện", () => {
    const v = brandCssVars("#0A6EBD", false);
    for (const k of ["--sa", "--sa2", "--ssoft", "--ssoft2", "--sg", "--sgb", "--son"]) expect(v[k]).toBeTruthy();
    expect(v["--sa"]).toBe("#0A6EBD");
  });
});

describe("luật hiện logo", () => {
  it("vai trò của slide: bìa, tóm tắt, còn lại (kể cả slide tương tác không có bố cục)", () => {
    expect(slideRole("cover")).toBe("cover");
    expect(slideRole("summary")).toBe("summary");
    expect(slideRole("cards")).toBe("other");
    expect(slideRole(null)).toBe("other");
    expect(slideRole(undefined)).toBe("other");
  });
  it("Mọi slide / Trừ bìa / Bìa và tóm tắt", () => {
    for (const r of ["cover", "summary", "other"] as const) expect(logoVisibleOn("all", r)).toBe(true);
    expect(["cover", "summary", "other"].map((r) => logoVisibleOn("nocover", r as never))).toEqual([false, true, true]);
    expect(["cover", "summary", "other"].map((r) => logoVisibleOn("ends", r as never))).toEqual([true, true, false]);
  });
  it("đủ giá trị liệt kê", () => {
    expect([...BRAND_POSITIONS]).toEqual(["tl", "tr", "bl", "br"]);
    expect([...BRAND_SIZES]).toEqual(["s", "m", "l"]);
    expect([...BRAND_SHOWS]).toEqual(["all", "nocover", "ends"]);
  });
});

describe("chỗ của logo trên khung 1280×720", () => {
  it("vị trí theo góc và chiều cao theo cỡ", () => {
    expect(logoPlacement("tr", "m")).toEqual({ height: 64, top: 36, right: 36 });
    expect(logoPlacement("bl", "l")).toEqual({ height: 92, bottom: 36, left: 36 });
  });
  it("nội dung thu nhỏ vừa đủ chừa chỗ, cỡ lớn thu nhiều hơn cỡ nhỏ và không thu quá 20%", () => {
    const s = contentScaleForLogo("s"), m = contentScaleForLogo("m"), l = contentScaleForLogo("l");
    expect(s).toBeGreaterThan(m);
    expect(m).toBeGreaterThan(l);
    expect(l).toBeGreaterThan(0.8);
    expect(s).toBeLessThan(1);
    expect(logoRoomPx("m")).toBe(88);
  });
});

describe("brandLogoFilename", () => {
  it("lấy tên tệp từ địa chỉ hợp lệ, null với địa chỉ lạ (không bao giờ xoá tệp ngoài thư mục logo)", () => {
    expect(brandLogoFilename(LOGO)).toBe("abc123-1.png");
    expect(brandLogoFilename("/api/limio-live-media/../x.png")).toBeNull();
    expect(brandLogoFilename("https://x/y.png")).toBeNull();
    expect(brandLogoFilename(undefined)).toBeNull();
  });
});
