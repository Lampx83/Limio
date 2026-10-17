import { describe, expect, it } from "vitest";
import {
  BRAND_POSITIONS,
  BRAND_SHOWS,
  BRAND_SIZES,
  MIN_CONTRAST,
  brandBackground,
  brandCssVars,
  brandEffectiveThemeId,
  brandFrameBackground,
  extractLogoColors,
  BRAND_TEMPLATE_IDS,
  applyBrandTemplate,
  brandLogoFilename,
  brandTemplates,
  completeBrandColors,
  deckEffectiveBrand,
  orgBrandConfig,
  resolveEffectiveBrand,
  sanitizeOrgBrandSettings,
  validateOrgBrandInput,
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
    expect(sanitizeBrand({ colors: {} })).toBeNull();
    expect(sanitizeBrand({ colors: { secondary: "#0E7490" } })).toBeNull();
  });
  it("giữ giá trị hợp lệ, mã màu viết hoa, giá trị lạ về mặc định", () => {
    expect(
      sanitizeBrand({ logoUrl: LOGO, colors: { primary: "#0a6ebd", secondary: "#0e7490", accent: "#f59e0b" }, logoPos: "bl", logoSize: "l", logoShow: "ends" }),
    ).toEqual({ logoUrl: LOGO, colors: { primary: "#0A6EBD", secondary: "#0E7490", accent: "#F59E0B" }, logoPos: "bl", logoSize: "l", logoShow: "ends", bg: "theme" });
    expect(sanitizeBrand({ colors: { primary: "#0A6EBD" }, logoPos: "giữa", logoSize: "xl", logoShow: "không" })).toEqual({
      colors: { primary: "#0A6EBD" }, logoPos: "tr", logoSize: "m", logoShow: "all", bg: "theme",
    });
  });
  it("bảng màu có đủ 3 ô; ô phụ hoặc nhấn sai thì bỏ riêng ô đó", () => {
    expect(sanitizeBrand({ colors: { primary: "#0A6EBD", secondary: "đỏ", accent: "#F59E0B" } })!.colors).toEqual({ primary: "#0A6EBD", accent: "#F59E0B" });
  });
  it("đọc được dữ liệu cũ chỉ có một màu (color) và coi là màu chính", () => {
    expect(sanitizeBrand({ color: "#0a6ebd" })!.colors).toEqual({ primary: "#0A6EBD" });
    // đã có colors thì bỏ qua color cũ
    expect(sanitizeBrand({ color: "#111111", colors: { primary: "#222222" } })!.colors).toEqual({ primary: "#222222" });
  });
  it("bỏ địa chỉ logo ngoài thư mục tải lên của Limio-Live và mã màu sai", () => {
    expect(sanitizeBrand({ logoUrl: "https://evil.example/x.png", colors: { primary: "đỏ" } })).toBeNull();
    expect(sanitizeBrand({ logoUrl: "/api/limio-live-media/../../etc/passwd" })).toBeNull();
    expect(sanitizeBrand({ logoUrl: "javascript:alert(1)", colors: { primary: "#12345" } })).toBeNull();
    expect(sanitizeBrand({ logoUrl: LOGO, colors: { primary: "#GGGGGG" } })).toMatchObject({ logoUrl: LOGO });
    expect(sanitizeBrand({ logoUrl: LOGO, colors: { primary: "#GGGGGG" } })).not.toHaveProperty("colors");
  });
});

describe("validateBrandInput (API lưu)", () => {
  it("null là xoá thương hiệu", () => expect(validateBrandInput(null)).toEqual({ ok: true, brand: null }));
  it("từ chối giá trị sai thay vì lẳng lặng bỏ", () => {
    expect(validateBrandInput(5)).toEqual({ ok: false, error: "invalid_brand" });
    expect(validateBrandInput({ color: "đỏ" })).toEqual({ ok: false, error: "invalid_color" });
    expect(validateBrandInput({ colors: [] })).toEqual({ ok: false, error: "invalid_colors" });
    expect(validateBrandInput({ colors: "#FFF" })).toEqual({ ok: false, error: "invalid_colors" });
    expect(validateBrandInput({ colors: { primary: "đỏ" } })).toEqual({ ok: false, error: "invalid_color_primary" });
    expect(validateBrandInput({ colors: { primary: "#0A6EBD", secondary: "xanh" } })).toEqual({ ok: false, error: "invalid_color_secondary" });
    expect(validateBrandInput({ colors: { primary: "#0A6EBD", accent: "#12" } })).toEqual({ ok: false, error: "invalid_color_accent" });
    expect(validateBrandInput({ colors: { secondary: "#0E7490" } })).toEqual({ ok: false, error: "missing_primary_color" });
    expect(validateBrandInput({ logoUrl: "https://x/y.png" })).toEqual({ ok: false, error: "invalid_logo_url" });
    expect(validateBrandInput({ logoUrl: LOGO, logoPos: "giữa" })).toEqual({ ok: false, error: "invalid_logoPos" });
    expect(validateBrandInput({ logoUrl: LOGO, logoSize: "xl" })).toEqual({ ok: false, error: "invalid_logoSize" });
    expect(validateBrandInput({ logoUrl: LOGO, logoShow: "x" })).toEqual({ ok: false, error: "invalid_logoShow" });
  });
  it("nhận bảng màu 3 ô; ô trống nghĩa là tự động; hết logo và màu thì thành null", () => {
    expect(validateBrandInput({ logoUrl: LOGO, colors: { primary: "#0A6EBD", secondary: "", accent: "" } })).toMatchObject({
      ok: true, brand: { logoUrl: LOGO, colors: { primary: "#0A6EBD" } },
    });
    expect(validateBrandInput({ colors: { primary: "#0A6EBD", secondary: "#0E7490", accent: "#F59E0B" }, logoPos: "br" })).toMatchObject({
      ok: true, brand: { colors: { primary: "#0A6EBD", secondary: "#0E7490", accent: "#F59E0B" }, logoPos: "br" },
    });
    expect(validateBrandInput({ colors: {} })).toEqual({ ok: true, brand: null });
    expect(validateBrandInput({ color: "#0A6EBD" })).toMatchObject({ ok: true, brand: { colors: { primary: "#0A6EBD" } } });
  });
});

describe("brandPalette (3 màu)", () => {
  const P = { primary: "#0A6EBD" };
  it("không có màu chính hoặc màu chính hỏng cho null", () => {
    expect(brandPalette(undefined, false)).toBeNull();
    expect(brandPalette({ primary: "đỏ" }, false)).toBeNull();
  });
  it("chỉ có màu chính: phụ và nhấn tự sinh khác màu chính, màu chính đủ tương phản thì giữ nguyên", () => {
    const p = brandPalette(P, false)!;
    expect(p.sa).toBe("#0A6EBD");
    expect(p.sa2).not.toBe(p.sa);
    expect(p.accent).not.toBe(p.sa);
    expect(p.adjusted).toEqual([]);
  });
  it("dùng đúng màu phụ và màu nhấn khi người dùng đặt", () => {
    const p = brandPalette({ primary: "#0A6EBD", secondary: "#0E7490", accent: "#F59E0B" }, false)!;
    expect(p.sa).toBe("#0A6EBD");
    expect(p.sa2).toBe("#0E7490");
    expect(p.accent).toBe("#F59E0B");
    expect(p.sg).toContain("#0A6EBD");
    expect(p.sg).toContain("#0E7490");
    expect(p.sgb).toContain("#F59E0B");
  });
  it("màu nhấn chỉ để trang trí nên không bị chỉnh tương phản, màu chữ thì có", () => {
    const p = brandPalette({ primary: "#F5C518", secondary: "#FDE047", accent: "#FEF08A" }, false)!;
    expect(p.accent).toBe("#FEF08A");
    expect(p.adjusted).toEqual(["primary", "secondary"]);
    expect(contrastRatio(p.sa, "#FFFFFF")).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(p.sa2, "#FFFFFF")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
  it("màu quá nhạt trên nền sáng được làm đậm; quá tối trên nền tối được làm sáng", () => {
    const light = brandPalette({ primary: "#F5C518" }, false)!;
    expect(light.adjusted).toEqual(["primary"]);
    expect(contrastRatio(light.sa, "#FFFFFF")).toBeGreaterThanOrEqual(MIN_CONTRAST);
    const dark = brandPalette({ primary: "#1E3A8A", secondary: "#1E40AF" }, true)!;
    expect(dark.adjusted).toEqual(["primary", "secondary"]);
    expect(contrastRatio(dark.sa, "#0B1020")).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(dark.sa2, "#0B1020")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
  it("mọi bộ màu thử đều đạt độ tương phản tối thiểu ở cả hai nền (kể cả trắng, đen, xám)", () => {
    for (const c of ["#0A6EBD", "#B91C1C", "#0F766E", "#7C3AED", "#C2410C", "#F5C518", "#FFFFFF", "#000000", "#00FF00", "#808080"]) {
      for (const dark of [false, true]) {
        const p = brandPalette({ primary: c, secondary: c }, dark)!;
        const bg = dark ? "#0B1020" : "#FFFFFF";
        expect(contrastRatio(p.sa, bg), `${c} chính ${dark ? "tối" : "sáng"}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
        expect(contrastRatio(p.sa2, bg), `${c} phụ ${dark ? "tối" : "sáng"}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });
  it("nền tối dùng nền thẻ trong suốt; chữ trên nút chọn đen hoặc trắng theo độ sáng của cả hai điểm màu", () => {
    expect(brandPalette(P, true)!.soft).toContain("rgba");
    expect(brandPalette(P, false)!.soft).toMatch(/^#/);
    expect(["#FFFFFF", "#111111"]).toContain(brandPalette({ primary: "#F5C518" }, true)!.on);
    // nút nền sáng (màu nhấn vàng) thì chữ phải đen dù màu chính tối
    expect(brandPalette({ primary: "#27272A", accent: "#FDE047" }, false)!.on).toBe("#111111");
    expect(brandPalette({ primary: "#27272A", accent: "#1D4ED8" }, false)!.on).toBe("#FFFFFF");
  });
});

describe("brandCssVars", () => {
  it("không có màu thì không ghi đè gì", () => {
    expect(brandCssVars(undefined, false)).toEqual({});
    expect(brandCssVars(null, true)).toEqual({});
    expect(brandCssVars({ colors: { primary: "hỏng" }, bg: "theme" }, false)).toEqual({});
  });
  it("ghi đè đủ các biến màu nhấn của giao diện; vầng sáng dùng màu chính và màu nhấn", () => {
    const v = brandCssVars({ colors: { primary: "#0A6EBD", secondary: "#0E7490", accent: "#F59E0B" }, bg: "theme" }, false);
    for (const k of ["--sa", "--sa2", "--ssoft", "--ssoft2", "--sg", "--sgb", "--son", "--sglow1", "--sglow2"]) expect(v[k]).toBeTruthy();
    expect(v["--sa"]).toBe("#0A6EBD");
    expect(v["--sa2"]).toBe("#0E7490");
    expect(v["--sglow2"]).toBe("#F59E0B");
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

const C3 = { primary: "#0A6EBD", secondary: "#0E7490", accent: "#F59E0B" };

describe("nền xuyệt tông", () => {
  it("sanitize/validate nhận bg; mặc định theo giao diện; không có bảng màu thì luôn theo giao diện", () => {
    expect(sanitizeBrand({ colors: C3, bg: "dark" })!.bg).toBe("dark");
    expect(sanitizeBrand({ colors: C3, bg: "light" })!.bg).toBe("light");
    expect(sanitizeBrand({ colors: C3, bg: "lạ" })!.bg).toBe("theme");
    expect(sanitizeBrand({ logoUrl: LOGO, bg: "dark" })!.bg).toBe("theme");
    expect(validateBrandInput({ colors: C3, bg: "lạ" })).toEqual({ ok: false, error: "invalid_bg" });
    expect(validateBrandInput({ colors: C3, bg: "light" })).toMatchObject({ ok: true, brand: { bg: "light" } });
  });
  it("brandBackground: theo giao diện hoặc không có màu chính thì null", () => {
    expect(brandBackground(C3, "theme")).toBeNull();
    expect(brandBackground(undefined, "light")).toBeNull();
    expect(brandBackground({ primary: "đỏ" }, "dark")).toBeNull();
  });
  it("nền sáng rất sáng, nền tối rất tối, cùng sắc độ với màu chính", () => {
    const lum = (css: string) => {
      const hexes = css.match(/#[0-9A-F]{6}/g)!;
      return hexes.map((h) => {
        const n = parseInt(h.slice(1), 16);
        return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
      });
    };
    for (const l of lum(brandBackground(C3, "light")!)) expect(l).toBeGreaterThan(0.9);
    for (const l of lum(brandBackground(C3, "dark")!)) expect(l).toBeLessThan(0.2);
    expect(brandBackground(C3, "light")).toMatch(/^linear-gradient\(135deg, #[0-9A-F]{6} 0%, #[0-9A-F]{6} 100%\)$/);
  });
  it("chữ trên nền xuyệt tông luôn đủ tương phản (mọi màu thử, cả hai tông)", () => {
    for (const c of ["#0A6EBD", "#B91C1C", "#0F766E", "#7C3AED", "#C2410C", "#F5C518", "#FFFFFF", "#000000", "#00FF00", "#808080"]) {
      const light = brandCssVars({ colors: { primary: c }, bg: "light" }, true);
      const dark = brandCssVars({ colors: { primary: c }, bg: "dark" }, false);
      // cả hai điểm màu của dải nền đều phải đủ tương phản với chữ (mức AAA, 7:1)
      for (const stop of brandBackground({ primary: c }, "light")!.match(/#[0-9A-F]{6}/g)!) expect(contrastRatio(light["--stext"]!, stop), `chữ ${c} sáng ${stop}`).toBeGreaterThanOrEqual(7);
      for (const stop of brandBackground({ primary: c }, "dark")!.match(/#[0-9A-F]{6}/g)!) expect(contrastRatio(dark["--stext"]!, stop), `chữ ${c} tối ${stop}`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(light["--sa"]!, "#FFFFFF"), `nhấn ${c} sáng`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(dark["--sa"]!, "#0B1020"), `nhấn ${c} tối`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
  it("nền xuyệt tông đặt cả nền, màu chữ và thẻ; theo giao diện thì không đụng tới", () => {
    const t = brandCssVars({ colors: C3, bg: "theme" }, false);
    expect(t["--sbg"]).toBeUndefined();
    expect(t["--stext"]).toBeUndefined();
    const l = brandCssVars({ colors: C3, bg: "light" }, true);
    expect(l["--sbg"]).toBeTruthy();
    expect(l["--stext"]).toBe("#20241F");
    const d = brandCssVars({ colors: C3, bg: "dark" }, false);
    expect(d["--stext"]).toBe("#F1F5F9");
    expect(d["--scard"]).toContain("rgba");
  });
  it("nền xuyệt tông đè lên giao diện: tối mượn giao diện night, sáng mượn white, theo giao diện giữ nguyên", () => {
    expect(brandEffectiveThemeId({ colors: C3, bg: "dark" }, "paper")).toBe("night");
    expect(brandEffectiveThemeId({ colors: C3, bg: "light" }, "night")).toBe("white");
    expect(brandEffectiveThemeId({ colors: C3, bg: "theme" }, "paper")).toBe("paper");
    expect(brandEffectiveThemeId(null, "mint")).toBe("mint");
    // có bg nhưng chưa có bảng màu thì không áp dụng
    expect(brandEffectiveThemeId({ bg: "dark" }, "mint")).toBe("mint");
  });
  it("nền tối chỉ áp cho slide hỗ trợ nền tối; nền sáng áp cho mọi slide", () => {
    expect(brandFrameBackground({ colors: C3, bg: "dark" }, true)).toBeTruthy();
    expect(brandFrameBackground({ colors: C3, bg: "dark" }, false)).toBeNull();
    expect(brandFrameBackground({ colors: C3, bg: "light" }, false)).toBeTruthy();
    expect(brandFrameBackground({ colors: C3, bg: "theme" }, true)).toBeNull();
    expect(brandFrameBackground(null, true)).toBeNull();
  });
});

/** Dựng dữ liệu RGBA: mỗi phần tử { c: [r,g,b,a], n: số điểm }. */
const px = (...parts: Array<{ c: [number, number, number, number]; n: number }>) => {
  const out: number[] = [];
  for (const p of parts) for (let i = 0; i < p.n; i++) out.push(...p.c);
  return out;
};

describe("extractLogoColors (gợi ý màu từ logo)", () => {
  it("lấy các màu nổi bật theo mức xuất hiện, bỏ nền trong suốt và nền trắng", () => {
    const data = px(
      { c: [0, 0, 0, 0], n: 500 }, // trong suốt
      { c: [255, 255, 255, 255], n: 300 }, // trắng
      { c: [10, 110, 189, 255], n: 400 }, // lam
      { c: [245, 158, 11, 255], n: 150 }, // cam
      { c: [14, 116, 144, 255], n: 120 }, // lục lam
    );
    const r = extractLogoColors(data);
    expect(r[0]).toBe("#0A6EBD");
    expect(r).toContain("#F59E0B");
    expect(r.length).toBeLessThanOrEqual(3);
    expect(new Set(r).size).toBe(r.length);
  });
  it("hai màu cùng sắc độ chỉ chọn một (cách nhau đủ xa)", () => {
    const data = px({ c: [10, 110, 189, 255], n: 300 }, { c: [20, 120, 200, 255], n: 200 }, { c: [245, 158, 11, 255], n: 100 });
    const r = extractLogoColors(data);
    expect(r).toHaveLength(2);
  });
  it("logo toàn xám hoặc đen thì trả màu tối trung bình làm màu chính", () => {
    const r = extractLogoColors(px({ c: [30, 30, 30, 255], n: 200 }, { c: [255, 255, 255, 255], n: 100 }));
    expect(r).toEqual(["#1E1E1E"]);
  });
  it("ảnh trống hoặc chỉ nền thì không gợi ý gì; tôn trọng số màu tối đa", () => {
    expect(extractLogoColors([])).toEqual([]);
    expect(extractLogoColors(px({ c: [0, 0, 0, 0], n: 50 }))).toEqual([]);
    const many = px({ c: [255, 0, 0, 255], n: 90 }, { c: [0, 255, 0, 255], n: 80 }, { c: [0, 0, 255, 255], n: 70 }, { c: [255, 255, 0, 255], n: 60 });
    expect(extractLogoColors(many, 2)).toHaveLength(2);
    expect(extractLogoColors(many)).toHaveLength(3);
  });
});

const ORG_LOGO = "/api/org-logos/bkhn-abc123.png";
const ORG_SETTINGS = { colors: { primary: "#B91C1C", secondary: "#9A3412", accent: "#FACC15" }, logoPos: "tl", logoSize: "l", logoShow: "nocover", bg: "light" };

describe("thương hiệu của đơn vị", () => {
  it("địa chỉ logo của trường được chấp nhận làm logo thương hiệu, nhưng không bị dọn tệp như logo của bài giảng", () => {
    expect(sanitizeBrand({ logoUrl: ORG_LOGO })!.logoUrl).toBe(ORG_LOGO);
    expect(brandLogoFilename(ORG_LOGO)).toBeNull();
    expect(brandLogoFilename(LOGO)).toBe("abc123-1.png");
    expect(sanitizeBrand({ logoUrl: "/api/org-logos/../x.png" })).toBeNull();
  });
  it("sanitizeOrgBrandSettings giữ vị trí/cỡ logo dù chưa có màu, không có logoUrl, nền chỉ khi có màu", () => {
    expect(sanitizeOrgBrandSettings(null)).toBeNull();
    expect(sanitizeOrgBrandSettings({ logoPos: "bl", logoSize: "s", logoUrl: ORG_LOGO, bg: "dark" })).toEqual({ logoPos: "bl", logoSize: "s", logoShow: "all", bg: "theme" });
    expect(sanitizeOrgBrandSettings(ORG_SETTINGS)).toEqual(ORG_SETTINGS);
  });
  it("validateOrgBrandInput: không nhận logoUrl, từ chối giá trị sai, null là xoá", () => {
    expect(validateOrgBrandInput(null)).toEqual({ ok: true, brand: null });
    expect(validateOrgBrandInput({ ...ORG_SETTINGS, logoUrl: ORG_LOGO })).toEqual({ ok: false, error: "logo_url_not_allowed" });
    expect(validateOrgBrandInput({ colors: { primary: "đỏ" } })).toEqual({ ok: false, error: "invalid_color_primary" });
    expect(validateOrgBrandInput({ logoPos: "giữa" })).toEqual({ ok: false, error: "invalid_logoPos" });
    expect(validateOrgBrandInput(ORG_SETTINGS)).toEqual({ ok: true, brand: ORG_SETTINGS });
    expect(validateOrgBrandInput({ logoPos: "br" })).toMatchObject({ ok: true, brand: { logoPos: "br", bg: "theme" } });
  });
  it("orgBrandConfig: ghép cài đặt với logo của trường; chưa có gì thì null; chỉ có logo vẫn dùng được", () => {
    expect(orgBrandConfig(null, null)).toBeNull();
    expect(orgBrandConfig({ logoPos: "br" }, null)).toBeNull();
    expect(orgBrandConfig(null, ORG_LOGO)).toMatchObject({ logoUrl: ORG_LOGO, logoPos: "tr", bg: "theme" });
    const b = orgBrandConfig({ ...ORG_SETTINGS, logoUrl: "/api/limio-live-media/khac.png" }, ORG_LOGO)!;
    expect(b.logoUrl).toBe(ORG_LOGO); // bỏ qua logoUrl nằm trong JSON
    expect(b.colors).toEqual(ORG_SETTINGS.colors);
    expect(b.logoPos).toBe("tl");
    expect(orgBrandConfig(ORG_SETTINGS, "https://evil/x.png")).not.toHaveProperty("logoUrl");
  });
});

describe("resolveEffectiveBrand (bài giảng dùng thương hiệu nào)", () => {
  const orgBrand = ORG_SETTINGS;
  it("không có gì thì không có thương hiệu", () => {
    expect(resolveEffectiveBrand({ deckBrand: null })).toEqual({ brand: null, source: "none" });
  });
  it("bài giảng chưa có thương hiệu riêng thì kế thừa của đơn vị", () => {
    const r = resolveEffectiveBrand({ deckBrand: null, orgBrand, orgLogoUrl: ORG_LOGO });
    expect(r.source).toBe("org");
    expect(r.brand).toMatchObject({ logoUrl: ORG_LOGO, colors: ORG_SETTINGS.colors, bg: "light" });
  });
  it("thương hiệu riêng của bài thắng hoàn toàn, không trộn với của đơn vị", () => {
    const r = resolveEffectiveBrand({ deckBrand: { colors: { primary: "#0A6EBD" } }, orgBrand, orgLogoUrl: ORG_LOGO });
    expect(r.source).toBe("deck");
    expect(r.brand!.colors).toEqual({ primary: "#0A6EBD" });
    expect(r.brand).not.toHaveProperty("logoUrl");
  });
  it("brandOff tắt hẳn dù đơn vị hay bài có thương hiệu", () => {
    expect(resolveEffectiveBrand({ deckBrand: { colors: { primary: "#0A6EBD" } }, brandOff: true, orgBrand, orgLogoUrl: ORG_LOGO })).toEqual({ brand: null, source: "none" });
  });
  it("thương hiệu riêng hỏng thì rơi về của đơn vị; đơn vị chưa có thì không có", () => {
    expect(resolveEffectiveBrand({ deckBrand: { colors: { primary: "đỏ" } }, orgBrand, orgLogoUrl: ORG_LOGO }).source).toBe("org");
    expect(resolveEffectiveBrand({ deckBrand: { colors: { primary: "đỏ" } } }).source).toBe("none");
  });
});

describe("mẫu thương hiệu sinh từ màu của trường", () => {
  const ORG = { primary: "#B91C1C", secondary: "#9A3412", accent: "#FACC15" };

  it("không có màu chính thì không có mẫu; có thì mẫu đầu luôn là mặc định của trường", () => {
    expect(brandTemplates(undefined)).toEqual([]);
    expect(brandTemplates({ primary: "đỏ" })).toEqual([]);
    const t = brandTemplates(ORG, "light");
    expect(t[0]).toMatchObject({ id: "default", colors: ORG, bg: "light" });
  });
  it("đủ các mẫu, mã nằm trong danh mục, mỗi mẫu đều dựng được bảng màu", () => {
    const t = brandTemplates(ORG, "theme");
    expect(t.map((x) => x.id)).toEqual([...BRAND_TEMPLATE_IDS]);
    for (const x of t) {
      expect(x.label && x.hint).toBeTruthy();
      expect(brandPalette(x.colors, x.bg === "dark")).not.toBeNull();
    }
  });
  it("đảo màu hoán đổi chính/phụ; đơn sắc chỉ giữ màu chính; sáng/tối đổi nền", () => {
    const t = Object.fromEntries(brandTemplates(ORG, "theme").map((x) => [x.id, x]));
    expect(t["swap-light"]!.colors).toEqual({ primary: "#9A3412", secondary: "#B91C1C", accent: "#FACC15" });
    expect(t["swap-light"]!.bg).toBe("light");
    expect(t["swap-dark"]!.bg).toBe("dark");
    expect(t["mono-light"]!.colors).toEqual({ primary: "#B91C1C" });
    expect(t["mono-dark"]!.bg).toBe("dark");
    expect(t.light!.bg).toBe("light");
    expect(t.dark!.bg).toBe("dark");
  });
  it("trường chỉ có màu chính: đảo màu dùng màu phụ tự sinh, vẫn khác mẫu thường", () => {
    const only = { primary: "#0A6EBD" };
    const full = completeBrandColors(only)!;
    const t = Object.fromEntries(brandTemplates(only, "theme").map((x) => [x.id, x]));
    expect(t["swap-light"]!.colors.primary).toBe(full.secondary);
    expect(t["swap-light"]!.colors.primary).not.toBe("#0A6EBD");
  });
  it("mẫu trùng hệt mẫu trước đó thì bỏ (đơn sắc khi trường chỉ có màu chính không trùng mẫu nào)", () => {
    const t = brandTemplates({ primary: "#0A6EBD" }, "light");
    expect(t.filter((x) => x.id === "light")).toHaveLength(0); // trùng với mặc định (nền sáng)
    expect(t[0]!.id).toBe("default");
  });
  it("applyBrandTemplate giữ logo, vị trí, cỡ, chỗ hiện và chỉ đổi màu và nền; mã lạ về mặc định", () => {
    const org = { logoUrl: ORG_LOGO, logoPos: "tl", logoSize: "l", logoShow: "nocover", colors: ORG, bg: "theme" } as const;
    const swapped = applyBrandTemplate(org, "swap-dark");
    expect(swapped).toMatchObject({ logoUrl: ORG_LOGO, logoPos: "tl", logoSize: "l", logoShow: "nocover", bg: "dark" });
    expect(swapped.colors!.primary).toBe("#9A3412");
    expect(applyBrandTemplate(org, "không có")).toBe(org);
    expect(applyBrandTemplate(org, undefined)).toBe(org);
    expect(applyBrandTemplate({ logoPos: "tr", logoSize: "m", logoShow: "all", bg: "theme", logoUrl: ORG_LOGO }, "dark").colors).toBeUndefined();
  });
  it("mẫu mặc định của trường: admin chọn được; giảng viên chọn mẫu khác cho từng bài", () => {
    const orgSettings = { ...ORG_SETTINGS, defaultTemplate: "dark" };
    expect(sanitizeOrgBrandSettings(orgSettings)!.defaultTemplate).toBe("dark");
    expect(sanitizeOrgBrandSettings({ ...ORG_SETTINGS, defaultTemplate: "lạ" })).not.toHaveProperty("defaultTemplate");
    expect(sanitizeOrgBrandSettings({ ...ORG_SETTINGS, defaultTemplate: "default" })).not.toHaveProperty("defaultTemplate");
    expect(validateOrgBrandInput({ ...ORG_SETTINGS, defaultTemplate: "lạ" })).toEqual({ ok: false, error: "invalid_template" });
    // không có bảng màu thì mẫu mặc định vô nghĩa
    expect(sanitizeOrgBrandSettings({ defaultTemplate: "dark" })).not.toHaveProperty("defaultTemplate");

    expect(resolveEffectiveBrand({ deckBrand: null, orgBrand: orgSettings, orgLogoUrl: ORG_LOGO }).brand!.bg).toBe("dark");
    expect(resolveEffectiveBrand({ deckBrand: null, orgBrand: orgSettings, orgLogoUrl: ORG_LOGO, deckTemplate: "swap-light" }).brand).toMatchObject({ bg: "light" });
    expect(resolveEffectiveBrand({ deckBrand: null, orgBrand: orgSettings, orgLogoUrl: ORG_LOGO, deckTemplate: "default" }).brand!.bg).toBe("light");
    // mẫu của bài chỉ có tác dụng khi bài dùng thương hiệu của trường
    expect(resolveEffectiveBrand({ deckBrand: { colors: { primary: "#0A6EBD" } }, orgBrand: orgSettings, orgLogoUrl: ORG_LOGO, deckTemplate: "dark" }).source).toBe("deck");
    expect(resolveEffectiveBrand({ deckBrand: null, brandOff: true, orgBrand: orgSettings, orgLogoUrl: ORG_LOGO, deckTemplate: "dark" }).brand).toBeNull();
  });
});

describe("deckEffectiveBrand (từ các trường của bài giảng)", () => {
  const org = { slideBrand: ORG_SETTINGS, logoUrl: ORG_LOGO };
  it("bài chưa đặt gì và trường chưa có bộ thương hiệu thì không có thương hiệu", () => {
    expect(deckEffectiveBrand({})).toBeNull();
    expect(deckEffectiveBrand({ org: null })).toBeNull();
    expect(deckEffectiveBrand({ org: { slideBrand: null, logoUrl: null } })).toBeNull();
  });
  it("thuộc trường có bộ thương hiệu thì bài mới tự có (mẫu mặc định), đổi mẫu theo từng bài", () => {
    expect(deckEffectiveBrand({ org })!).toMatchObject({ logoUrl: ORG_LOGO, bg: "light" });
    expect(deckEffectiveBrand({ org, brandTemplate: "dark" })!.bg).toBe("dark");
  });
  it("riêng và tắt thắng của trường", () => {
    expect(deckEffectiveBrand({ org, brand: { colors: { primary: "#0A6EBD" } } })!.colors).toEqual({ primary: "#0A6EBD" });
    expect(deckEffectiveBrand({ org, brand: { colors: { primary: "#0A6EBD" } }, brandOff: true })).toBeNull();
  });
});
