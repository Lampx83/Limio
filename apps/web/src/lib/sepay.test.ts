import { describe, expect, it } from "vitest";
import { SEPAY_DEFAULT_QR_URL, buildSepayQrUrl, verifySepayAuth } from "./sepay";

describe("verifySepayAuth", () => {
  const key = "khoa-bi-mat-dai-kho-doan-1234567890";
  it("chấp nhận đúng 'Apikey <khoá>' (không phân biệt hoa/thường tiền tố, bỏ khoảng trắng thừa)", () => {
    expect(verifySepayAuth(`Apikey ${key}`, key)).toBe(true);
    expect(verifySepayAuth(`apikey   ${key}  `, key)).toBe(true);
  });
  it("từ chối thiếu header, sai tiền tố, sai khoá, khoá rỗng", () => {
    expect(verifySepayAuth(null, key)).toBe(false);
    expect(verifySepayAuth(undefined, key)).toBe(false);
    expect(verifySepayAuth("", key)).toBe(false);
    expect(verifySepayAuth(`Bearer ${key}`, key)).toBe(false);
    expect(verifySepayAuth(key, key)).toBe(false);
    expect(verifySepayAuth("Apikey sai-khoa", key)).toBe(false);
    expect(verifySepayAuth(`Apikey ${key}x`, key)).toBe(false);
    expect(verifySepayAuth("Apikey ", key)).toBe(false);
    expect(verifySepayAuth("Apikey ", "")).toBe(false);
    expect(verifySepayAuth(`Apikey ${key}`, "")).toBe(false);
  });
});

describe("buildSepayQrUrl", () => {
  it("dựng địa chỉ QR có số tài khoản, ngân hàng, số tiền nguyên và nội dung (mã thanh toán)", () => {
    const url = new URL(buildSepayQrUrl({ accountNumber: "0123456789", bank: "Vietcombank", qrBaseUrl: SEPAY_DEFAULT_QR_URL }, 799000, "LMK7P3Q9XA2R"));
    expect(url.origin + url.pathname).toBe("https://qr.sepay.vn/img");
    expect(Object.fromEntries(url.searchParams)).toEqual({ acc: "0123456789", bank: "Vietcombank", amount: "799000", des: "LMK7P3Q9XA2R" });
  });
  it("mã hoá ký tự đặc biệt và bỏ phần lẻ của số tiền", () => {
    const u = buildSepayQrUrl({ accountNumber: "1", bank: "MB Bank", qrBaseUrl: "https://example.test/img" }, 199000.9, "A B&C");
    expect(u).toContain("bank=MB+Bank");
    expect(u).toContain("amount=199000");
    expect(u).toContain("des=A+B%26C");
  });
});
