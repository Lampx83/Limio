import { describe, expect, it } from "vitest";
import { sanitizeCallbackUrl, signedInRedirectTarget, withCallbackUrl } from "./callbackUrl";

describe("sanitizeCallbackUrl", () => {
  it("giữ path nội bộ, kể cả query", () => {
    expect(sanitizeCallbackUrl("/enroll/ABC123")).toBe("/enroll/ABC123");
    expect(sanitizeCallbackUrl("/exam/XYZ?x=1")).toBe("/exam/XYZ?x=1");
  });

  it("thiếu hoặc rỗng ⇒ /", () => {
    expect(sanitizeCallbackUrl(null)).toBe("/");
    expect(sanitizeCallbackUrl(undefined)).toBe("/");
    expect(sanitizeCallbackUrl("")).toBe("/");
  });

  it("chặn open-redirect", () => {
    expect(sanitizeCallbackUrl("https://evil.com")).toBe("/");
    expect(sanitizeCallbackUrl("//evil.com")).toBe("/");
    expect(sanitizeCallbackUrl("/\\evil.com")).toBe("/");
    expect(sanitizeCallbackUrl("/x?u=https://evil.com")).toBe("/");
    expect(sanitizeCallbackUrl("evil.com")).toBe("/");
  });
});

describe("signedInRedirectTarget", () => {
  it("đi thẳng tới đích", () => {
    expect(signedInRedirectTarget("/oral/ETHU2V")).toBe("/oral/ETHU2V");
    expect(signedInRedirectTarget("/exam/82WZ7Y?x=1")).toBe("/exam/82WZ7Y?x=1");
  });

  it("thiếu đích, đích lặp tham số hoặc đích ngoài ⇒ /", () => {
    expect(signedInRedirectTarget(undefined)).toBe("/");
    expect(signedInRedirectTarget(["/a", "/b"])).toBe("/");
    expect(signedInRedirectTarget("https://evil.com")).toBe("/");
  });

  it("đích trỏ về chính /signin ⇒ / để không lặp chuyển hướng", () => {
    expect(signedInRedirectTarget("/signin")).toBe("/");
    expect(signedInRedirectTarget("/signin?callbackUrl=/signin")).toBe("/");
    expect(signedInRedirectTarget("/signin-help")).toBe("/signin-help");
  });
});

describe("withCallbackUrl", () => {
  it("bỏ qua đích mặc định", () => {
    expect(withCallbackUrl("/register", "/")).toBe("/register");
  });

  it("mã hoá đích vào query", () => {
    expect(withCallbackUrl("/signin", "/enroll/AB?c=1")).toBe("/signin?callbackUrl=%2Fenroll%2FAB%3Fc%3D1");
  });
});
