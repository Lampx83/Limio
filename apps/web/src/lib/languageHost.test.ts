import { describe, expect, it } from "vitest";
import { hostMatches, languageHostRewrite } from "./languageHost";

describe("hostMatches", () => {
  it("khớp không phân biệt hoa thường, bỏ cổng và dấu chấm cuối; không đặt biến thì không khớp", () => {
    expect(hostMatches("Language.Limio.vn:3000", "language.limio.vn")).toBe(true);
    expect(hostMatches("language.limio.vn.", "language.limio.vn")).toBe(true);
    expect(hostMatches("limio.vn", "language.limio.vn")).toBe(false);
    expect(hostMatches("language.limio.vn", undefined)).toBe(false);
    expect(hostMatches("language.limio.vn", "  ")).toBe(false);
    expect(hostMatches(null, "language.limio.vn")).toBe(false);
  });
});

describe("languageHostRewrite", () => {
  it("chỉ viết lại '/' của tên miền riêng; không đụng tên miền khác hay đường dẫn khác", () => {
    expect(languageHostRewrite({ host: "language.limio.vn", languageHost: "language.limio.vn", pathname: "/" })).toBe("/language");
    expect(languageHostRewrite({ host: "language.limio.vn", languageHost: "language.limio.vn", pathname: "/catalog" })).toBeNull();
    expect(languageHostRewrite({ host: "limio.vn", languageHost: "language.limio.vn", pathname: "/" })).toBeNull();
    expect(languageHostRewrite({ host: "limio.vn", languageHost: undefined, pathname: "/" })).toBeNull();
  });
});
