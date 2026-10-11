import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const env = { ...process.env };
beforeEach(() => {
  delete process.env.GROWTH_ATTRIBUTION_ENABLED;
  delete process.env.NEXTAUTH_URL;
});
afterEach(() => {
  process.env = { ...env };
});

function req(url: string, headers: Record<string, string> = {}, method = "GET") {
  return new NextRequest(url, { method, headers });
}
const setCookie = (res: Response) => res.headers.get("set-cookie");

describe("middleware — growth attribution cookie", () => {
  it("cờ tắt (mặc định): không bao giờ đặt cookie, X-Robots-Tag vẫn như cũ", () => {
    const res = middleware(req("https://limio.vn/catalog?utm_source=facebook"));
    expect(setCookie(res)).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBeNull();
    const priv = middleware(req("https://limio.vn/admin?utm_source=facebook"));
    expect(priv.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(setCookie(priv)).toBeNull();
  });

  it("cờ bật: đặt limio_attr với HttpOnly, SameSite=Lax, Path=/, 90 ngày, Secure", () => {
    process.env.GROWTH_ATTRIBUTION_ENABLED = "true";
    const res = middleware(
      req("https://limio.vn/catalog?utm_source=Facebook&utm_medium=paid_social&fbclid=IwAR0X", {
        referer: "https://l.facebook.com/",
      }),
    );
    const c = setCookie(res)!;
    expect(c).toMatch(/^limio_attr=/);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=lax/i);
    expect(c).toMatch(/Path=\//);
    expect(c).toMatch(/Max-Age=7776000/);
    expect(c).toMatch(/Secure/i);
    expect(c).not.toContain("IwAR0X");
    const value = c.split(";")[0]!.split("=")[1]!;
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString());
    expect(decoded).toMatchObject({ s: "facebook", m: "paid_social", k: "fbclid", p: "/catalog", r: "l.facebook.com" });
  });

  it("http thường: không có Secure", () => {
    process.env.GROWTH_ATTRIBUTION_ENABLED = "true";
    const c = setCookie(middleware(req("http://localhost:3000/?utm_source=x")))!;
    expect(c).toMatch(/^limio_attr=/);
    expect(c).not.toMatch(/Secure/i);
  });

  it("không ghi đè cookie hợp lệ; bỏ qua /api, asset, POST, referrer nội bộ", () => {
    process.env.GROWTH_ATTRIBUTION_ENABLED = "true";
    const first = setCookie(middleware(req("https://limio.vn/?utm_source=first")))!;
    const value = first.split(";")[0]!.split("=")[1]!;
    const again = middleware(req("https://limio.vn/?utm_source=second", { cookie: `limio_attr=${value}` }));
    expect(setCookie(again)).toBeNull();

    for (const url of [
      "https://limio.vn/api/auth/session?utm_source=x",
      "https://limio.vn/_next/static/a.js?utm_source=x",
      "https://limio.vn/favicon.svg?utm_source=x",
      "https://limio.vn/robots.txt?utm_source=x",
    ]) {
      expect(setCookie(middleware(req(url))), url).toBeNull();
    }
    expect(setCookie(middleware(req("https://limio.vn/?utm_source=x", {}, "POST")))).toBeNull();
    expect(setCookie(middleware(req("https://limio.vn/catalog", { referer: "https://limio.vn/" })))).toBeNull();
    expect(setCookie(middleware(req("https://limio.vn/catalog")))).toBeNull();
  });
});
