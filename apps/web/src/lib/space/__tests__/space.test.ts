import { describe, expect, it } from "vitest";
import { builtinMicro4Asia } from "../builtin";
import { buildSpaceConfig, isValidSpaceSlug, normalizeStored, safeUrl } from "../settings";
import { derivePalette, isHexColor, mixHex, spaceThemeCss } from "../theme";
import { resolveSpaceLang } from "../lang";

describe("space: slug và URL", () => {
  it("chỉ nhận slug chữ thường/số/gạch nối và không trùng route hệ thống", () => {
    expect(isValidSpaceSlug("micro4asia")).toBe(true);
    expect(isValidSpaceSlug("dh-bach-khoa")).toBe(true);
    for (const bad of ["", "a", "Admin", "api", "s", "-x", "x-", "a b", "a/b", "x".repeat(41)]) {
      expect(isValidSpaceSlug(bad), bad).toBe(false);
    }
  });

  it("safeUrl chỉ nhận đường dẫn trong site hoặc https", () => {
    expect(safeUrl("/brand/x.png")).toBe("/brand/x.png");
    expect(safeUrl("https://a.vn/x.png")).toBe("https://a.vn/x.png");
    for (const bad of ["javascript:alert(1)", "data:image/svg+xml;base64,AAA", "//evil.com/x.png", "http://a.vn/x.png", ""]) {
      expect(safeUrl(bad), bad).toBeUndefined();
    }
  });
});

describe("space: chuẩn hoá cấu hình lưu", () => {
  it("bỏ giá trị hỏng, giữ giá trị hợp lệ", () => {
    const s = normalizeStored({
      name: "  Space A  ",
      primary: "#abcdef",
      accent: "red",
      logoUrl: "javascript:alert(1)",
      partnerLogoUrl: "/u/p.png",
      langs: ["en", "fr", "en"],
      courses: [
        { slug: "khoa-1", title: "Khoá 1", topic: { vi: "Chủ đề" } },
        { slug: "khoa-1", title: "Trùng" },
        { slug: "Bad Slug", title: "x" },
        { slug: "khoa-2", title: "" },
      ],
    });
    expect(s.name).toBe("Space A");
    expect(s.primary).toBe("#ABCDEF");
    expect(s.accent).toBeUndefined();
    expect(s.logoUrl).toBeUndefined();
    expect(s.partnerLogoUrl).toBe("/u/p.png");
    expect(s.langs).toEqual(["en"]);
    expect(s.courses).toHaveLength(1);
  });

  it("không bao giờ throw với dữ liệu lạ", () => {
    for (const raw of [null, undefined, 1, "x", [], { courses: "x", copy: 3, langs: 5 }]) {
      expect(() => normalizeStored(raw)).not.toThrow();
    }
  });

  it("buildSpaceConfig điền mặc định theo tên trường và dùng logo của trường nếu space chưa đặt", () => {
    const cfg = buildSpaceConfig({ slug: "dh-a", orgName: "ĐH A", orgLogoUrl: "/logo.svg", stored: {} });
    expect(cfg.name).toBe("ĐH A");
    expect(cfg.logoUrl).toBe("/logo.svg");
    expect(cfg.copy.en.metaDescription).toContain("ĐH A");
    expect(cfg.defaultLang).toBe("en");
    expect(cfg.courses).toEqual([]);
  });

  it("chữ do quản trị đặt ghi đè mặc định, phần còn lại giữ mặc định", () => {
    const cfg = buildSpaceConfig({
      slug: "dh-a",
      orgName: "ĐH A",
      orgLogoUrl: null,
      stored: { copy: { en: { heroLead: "Hello" } } },
    });
    expect(cfg.copy.en.heroLead).toBe("Hello");
    expect(cfg.copy.en.browse.length).toBeGreaterThan(0);
  });
});

describe("space: màu và theme", () => {
  it("isHexColor chỉ nhận #RRGGBB", () => {
    expect(isHexColor("#00528C")).toBe(true);
    for (const bad of ["00528C", "#00528", "red", "#00528CFF", "url(x)", 5]) expect(isHexColor(bad)).toBe(false);
  });

  it("derivePalette suy ra tông đậm và nhạt từ màu chủ đạo", () => {
    const p = derivePalette("#2563EB", "#F59E0B");
    expect(p.dark).not.toBe(p.primary);
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
    expect(isHexColor(p.dark) && isHexColor(p.soft) && isHexColor(p.accent2)).toBe(true);
  });

  it("CSS theme chỉ chứa màu hợp lệ của palette", () => {
    const css = spaceThemeCss(derivePalette("#00528C", "#FFC101"));
    expect(css).toContain("#00528C");
    expect(css).toContain(".btn-primary");
    expect(css).not.toMatch(/javascript|expression|url\(/i);
  });
});

describe("space: Micro4Asia dựng sẵn", () => {
  const cfg = builtinMicro4Asia();
  it("có sáu khoá, đủ hai ngôn ngữ, màu NEU", () => {
    expect(cfg.courses).toHaveLength(6);
    expect(cfg.palette.primary).toBe("#00528C");
    expect(cfg.copy.vi.heroLead.length).toBeGreaterThan(0);
  });
  it("statsOpen giữ chỗ {n}", () => {
    expect(cfg.copy.en.statsOpen).toContain("{n}");
    expect(cfg.copy.vi.statsOpen).toContain("{n}");
  });
  it("resolveSpaceLang theo ngôn ngữ space hỗ trợ", () => {
    expect(resolveSpaceLang(undefined, cfg)).toBe("en");
    expect(resolveSpaceLang("vi", cfg)).toBe("vi");
    expect(resolveSpaceLang("fr", cfg)).toBe("en");
    expect(resolveSpaceLang("vi", { langs: ["en"], defaultLang: "en" })).toBe("en");
  });
});
