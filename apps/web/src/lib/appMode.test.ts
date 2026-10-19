import { describe, expect, it } from "vitest";
import {
  APP_MODE_COOKIE,
  appModeSwitchPath,
  hostMatches,
  languageEntryRouting,
  resolveAppMode,
  safeNextPath,
} from "@/lib/appMode";

/** LANG L1 — chế độ ứng dụng (vỏ Limio Language). Hàm thuần: không đụng cookie/header thật. */

describe("hostMatches (L1.4)", () => {
  it("so tên miền không phân biệt hoa thường, bỏ cổng và dấu chấm cuối", () => {
    expect(hostMatches("Language.Limio.vn", "language.limio.vn")).toBe(true);
    expect(hostMatches("language.limio.vn:3000", "language.limio.vn")).toBe(true);
    expect(hostMatches("language.limio.vn.", "language.limio.vn")).toBe(true);
  });
  it("không đặt LANGUAGE_HOST (rỗng/undefined) thì KHÔNG BAO GIỜ khớp", () => {
    expect(hostMatches("language.limio.vn", undefined)).toBe(false);
    expect(hostMatches("language.limio.vn", "")).toBe(false);
    expect(hostMatches("", "")).toBe(false);
    expect(hostMatches(null, "language.limio.vn")).toBe(false);
  });
  it("khác tên miền thì không khớp (kể cả tên miền con/ghép chuỗi)", () => {
    expect(hostMatches("limio.vn", "language.limio.vn")).toBe(false);
    expect(hostMatches("evil-language.limio.vn", "language.limio.vn")).toBe(false);
    expect(hostMatches("language.limio.vn.evil.com", "language.limio.vn")).toBe(false);
  });
});

describe("resolveAppMode (L1.2) — chỉ tên miền riêng hoặc cookie; KHÔNG suy từ khoá", () => {
  const LH = "language.limio.vn";
  it("mặc định là default", () => {
    expect(resolveAppMode({})).toBe("default");
    expect(resolveAppMode({ cookie: undefined, host: "limio.vn", languageHost: LH })).toBe("default");
  });
  it("cookie language → language", () => {
    expect(resolveAppMode({ cookie: "language" })).toBe("language");
  });
  it("tên miền riêng thắng cookie, kể cả cookie nói default", () => {
    expect(resolveAppMode({ cookie: "default", host: LH, languageHost: LH })).toBe("language");
    expect(resolveAppMode({ cookie: undefined, host: LH, languageHost: LH })).toBe("language");
  });
  it("cookie rác/giá trị lạ → default (không bao giờ ném lỗi)", () => {
    for (const c of ["", "LANGUAGE", "1", "admin", "language ", "null"]) {
      expect(resolveAppMode({ cookie: c }), c).toBe("default");
    }
  });
  it("host khớp mà chưa đặt LANGUAGE_HOST thì chỉ cookie quyết định", () => {
    expect(resolveAppMode({ cookie: undefined, host: LH })).toBe("default");
  });
});

describe("safeNextPath — chống open redirect khi đổi chế độ", () => {
  it("nhận đường dẫn nội bộ, giữ query", () => {
    expect(safeNextPath("/me/skills", "/")).toBe("/me/skills");
    expect(safeNextPath("/learn/zh-co-ban?tab=tasks", "/")).toBe("/learn/zh-co-ban?tab=tasks");
  });
  it("từ chối URL tuyệt đối, //host, \\\\host, scheme, ký tự điều khiển → dùng fallback", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil", "", "/a\nb", "/%0d%0aSet-Cookie:x=1"]) {
      expect(safeNextPath(bad, "/language"), bad).toBe("/language");
    }
    expect(safeNextPath(undefined, "/x")).toBe("/x");
    expect(safeNextPath(null, "/x")).toBe("/x");
  });
});

describe("appModeSwitchPath (L1.3)", () => {
  it("dựng đường dẫn route đổi chế độ, mã hoá next", () => {
    expect(appModeSwitchPath("default")).toBe("/api/app-mode?to=default");
    expect(appModeSwitchPath("language", "/me/skills?a=1&b=2")).toBe(
      "/api/app-mode?to=language&next=%2Fme%2Fskills%3Fa%3D1%26b%3D2",
    );
  });
});

describe("languageEntryRouting — middleware (L1.1, L1.4)", () => {
  const LH = "language.limio.vn";
  it("vào /language (hoặc dưới nó) thì đặt chế độ language, không viết lại đường dẫn", () => {
    expect(languageEntryRouting({ host: "limio.vn", pathname: "/language" })).toEqual({ setMode: "language" });
    expect(languageEntryRouting({ host: "limio.vn", pathname: "/language/courses" })).toEqual({ setMode: "language" });
  });
  it("không nhầm /languages hay /language-x", () => {
    expect(languageEntryRouting({ host: "limio.vn", pathname: "/languages" })).toBeNull();
    expect(languageEntryRouting({ host: "limio.vn", pathname: "/language-x" })).toBeNull();
  });
  it("tên miền riêng: / được viết lại thành /language và đặt chế độ; trang khác chỉ đặt chế độ", () => {
    expect(languageEntryRouting({ host: LH, languageHost: LH, pathname: "/" })).toEqual({ rewriteTo: "/language", setMode: "language" });
    expect(languageEntryRouting({ host: LH, languageHost: LH, pathname: "/learn/zh" })).toEqual({ setMode: "language" });
  });
  it("tên miền riêng KHÔNG viết lại API/asset", () => {
    expect(languageEntryRouting({ host: LH, languageHost: LH, pathname: "/api/courses" })).toEqual({ setMode: "language" });
  });
  it("trang thường, host thường: không làm gì", () => {
    expect(languageEntryRouting({ host: "limio.vn", pathname: "/" })).toBeNull();
    expect(languageEntryRouting({ host: "limio.vn", languageHost: LH, pathname: "/me/skills" })).toBeNull();
  });
  it("tên cookie cố định", () => {
    expect(APP_MODE_COOKIE).toBe("limio_app");
  });
});
