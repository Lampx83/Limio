import { describe, expect, it } from "vitest";
import { sanitizeCallbackUrl, withCallbackUrl } from "./callbackUrl";

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

describe("withCallbackUrl", () => {
  it("bỏ qua đích mặc định", () => {
    expect(withCallbackUrl("/register", "/")).toBe("/register");
  });

  it("mã hoá đích vào query", () => {
    expect(withCallbackUrl("/signin", "/enroll/AB?c=1")).toBe("/signin?callbackUrl=%2Fenroll%2FAB%3Fc%3D1");
  });
});
