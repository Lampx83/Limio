import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_COOKIE,
  attributionCookieOptions,
  decideAttributionCookie,
  decodeAttributionCookie,
  encodeAttributionCookie,
  isPageNavigationPath,
  normalizeLandingPath,
  sanitizeHost,
  sanitizeValue,
  type AttributionDecisionInput,
  type AttributionTouch,
} from "./attribution";

const NOW = 1_760_000_000;

function b64url(s: string) {
  return Buffer.from(s, "utf8").toString("base64url");
}

describe("sanitizeValue", () => {
  it("trim, lower-case, chỉ giữ [a-z0-9 _.-:/+%]", () => {
    expect(sanitizeValue("  Facebook ")).toBe("facebook");
    expect(sanitizeValue("Oct-Teachers_2026")).toBe("oct-teachers_2026");
    expect(sanitizeValue("a<script>alert(1)</script>b")).toBe("ascriptalert1/scriptb");
    expect(sanitizeValue("x\u0000y\u001fz\u007f")).toBe("xyz");
    expect(sanitizeValue("sale 50% + more: a/b")).toBe("sale 50% + more: a/b");
    expect(sanitizeValue("đại học")).toBe("i hc");
    expect(sanitizeValue("a&b=c;d'e\"f?g#h")).toBe("abcdefgh");
  });
  it("cắt ở 100 ký tự và trả null khi rỗng / không phải chuỗi", () => {
    expect(sanitizeValue("a".repeat(500))).toBe("a".repeat(100));
    expect(sanitizeValue("   ")).toBeNull();
    expect(sanitizeValue("<>&")).toBeNull();
    expect(sanitizeValue(undefined)).toBeNull();
    expect(sanitizeValue(42)).toBeNull();
    expect(sanitizeValue(null)).toBeNull();
  });
});

describe("sanitizeHost", () => {
  it("chỉ lấy hostname", () => {
    expect(sanitizeHost("WWW.Google.com")).toBe("www.google.com");
    expect(sanitizeHost("l.facebook.com:443/x")).toBe("l.facebook.com");
    expect(sanitizeHost("")).toBeNull();
  });
});

describe("normalizeLandingPath", () => {
  it("bỏ query/hash, giữ đường dẫn công khai", () => {
    expect(normalizeLandingPath("/catalog?utm_source=x")).toBe("/catalog");
    expect(normalizeLandingPath("/")).toBe("/");
    expect(normalizeLandingPath("/catalog/tieng-anh-giao-tiep")).toBe("/catalog/tieng-anh-giao-tiep");
    expect(normalizeLandingPath("/learn/my-course/lessons/abc")).toBe("/learn/my-course");
  });
  it("che mã mời / token / id", () => {
    expect(normalizeLandingPath("/join/ABC123")).toBe("/join");
    expect(normalizeLandingPath("/verify/9f2c1d7e4b6a8c0d1e2f3a4b5c6d7e8f")).toBe("/verify");
    expect(normalizeLandingPath("/enroll/SECRETCODE")).toBe("/enroll");
    expect(normalizeLandingPath("/p/123e4567-e89b-12d3-a456-426614174000")).toBe("/p/:id");
    expect(normalizeLandingPath("/catalog/1234567890")).toBe("/catalog/:id");
  });
  it("giới hạn 200 ký tự và từ chối đầu vào lạ", () => {
    const out = normalizeLandingPath("/catalog/" + "a".repeat(500))!;
    expect(out.length).toBeLessThanOrEqual(200);
    expect(normalizeLandingPath("evil")).toBeNull();
    expect(normalizeLandingPath(undefined)).toBeNull();
  });
});

describe("cookie encode/decode", () => {
  const touch: AttributionTouch = {
    utmSource: "facebook",
    utmMedium: "paid_social",
    utmCampaign: "oct-teachers",
    utmContent: "video-a",
    utmTerm: "lms",
    clickIdKind: "fbclid",
    landingPath: "/catalog",
    referrerHost: "l.facebook.com",
    firstSeenAtSec: NOW,
  };

  it("round-trip giữ nguyên mọi trường", () => {
    const v = encodeAttributionCookie(touch);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeAttributionCookie(v, NOW)).toEqual(touch);
  });

  it("dùng khoá ngắn s/m/c/ct/t/k/p/r/at", () => {
    const o = JSON.parse(Buffer.from(encodeAttributionCookie(touch), "base64url").toString());
    expect(Object.keys(o).sort()).toEqual(["at", "c", "ct", "k", "m", "p", "r", "s", "t"]);
  });

  it("từ chối rác: không phải base64url / JSON / object", () => {
    for (const bad of [undefined, null, "", "!!!", "not base64 at all", b64url("not json"), b64url("[]"), b64url("42"), b64url("null")]) {
      expect(decodeAttributionCookie(bad as string, NOW)).toBeNull();
    }
  });

  it("từ chối cookie quá lớn", () => {
    const big = b64url(JSON.stringify({ s: "a".repeat(5000), at: NOW }));
    expect(big.length).toBeGreaterThan(2048);
    expect(decodeAttributionCookie(big, NOW)).toBeNull();
  });

  it("từ chối `at` vô lý (thiếu, không nguyên, quá cũ, ở tương lai xa)", () => {
    const mk = (at: unknown) => b64url(JSON.stringify({ s: "x", at }));
    expect(decodeAttributionCookie(mk(undefined), NOW)).toBeNull();
    expect(decodeAttributionCookie(mk("1760000000"), NOW)).toBeNull();
    expect(decodeAttributionCookie(mk(1.5), NOW)).toBeNull();
    expect(decodeAttributionCookie(mk(100), NOW)).toBeNull();
    expect(decodeAttributionCookie(mk(NOW + 10 * 86400), NOW)).toBeNull();
    expect(decodeAttributionCookie(mk(NOW), NOW)).not.toBeNull();
  });

  it("sanitise lại mọi chuỗi khi giải mã (cookie do client kiểm soát)", () => {
    const forged = b64url(
      JSON.stringify({
        s: "<img src=x onerror=alert(1)>",
        m: "A".repeat(300),
        c: { evil: true },
        k: "password",
        p: "/join/SECRETCODE?x=1",
        r: "EVIL.com/path?token=1",
        at: NOW,
      }),
    );
    const t = decodeAttributionCookie(forged, NOW)!;
    expect(t.utmSource).toBe("img srcx onerroralert1");
    expect(t.utmMedium).toBe("a".repeat(100));
    expect(t.utmCampaign).toBeNull();
    expect(t.clickIdKind).toBeNull();
    expect(t.landingPath).toBe("/join");
    expect(t.referrerHost).toBe("evil.com");
  });

  it("cookie không mang nguồn nào ⇒ không hợp lệ", () => {
    expect(decodeAttributionCookie(b64url(JSON.stringify({ at: NOW })), NOW)).toBeNull();
    expect(decodeAttributionCookie(b64url(JSON.stringify({ s: "<>", p: "/x", at: NOW })), NOW)).toBeNull();
  });
});

describe("isPageNavigationPath", () => {
  it("bỏ /api, /_next, favicon, file có đuôi", () => {
    for (const p of ["/api/auth/session", "/api", "/_next/static/x.js", "/favicon.svg", "/favicon", "/robots.txt", "/sitemap.xml", "/img/a.PNG", "/.well-known/x"]) {
      expect(isPageNavigationPath(p), p).toBe(false);
    }
    for (const p of ["/", "/catalog", "/learn/abc/lessons/1", "/signin", "/p/some.slug-with-dot"]) {
      // `/p/some.slug-with-dot` có "." nhưng đuôi dài > 8 hoặc chứa "-" nên vẫn là trang
      expect(isPageNavigationPath(p), p).toBe(true);
    }
  });
});

describe("decideAttributionCookie", () => {
  const base: AttributionDecisionInput = {
    method: "GET",
    pathname: "/catalog",
    searchParams: new URLSearchParams(),
    referer: null,
    siteHosts: ["limio.vn"],
    existingCookie: undefined,
    nowSec: NOW,
  };
  const q = (s: string) => new URLSearchParams(s);

  it("đặt cookie khi có utm_*", () => {
    const d = decideAttributionCookie({
      ...base,
      searchParams: q("utm_source=Facebook&utm_medium=paid_social&utm_campaign=oct&utm_content=a&utm_term=b"),
    });
    expect(d.action).toBe("set");
    if (d.action !== "set") return;
    expect(d.touch).toMatchObject({
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "oct",
      utmContent: "a",
      utmTerm: "b",
      clickIdKind: null,
      landingPath: "/catalog",
      referrerHost: null,
      firstSeenAtSec: NOW,
    });
    expect(decodeAttributionCookie(d.value, NOW)).toEqual(d.touch);
  });

  it("chỉ lưu LOẠI click id, không lưu giá trị", () => {
    const d = decideAttributionCookie({ ...base, searchParams: q("fbclid=IwAR0SECRETVALUE123") });
    expect(d.action).toBe("set");
    if (d.action !== "set") return;
    expect(d.touch.clickIdKind).toBe("fbclid");
    expect(JSON.stringify(d)).not.toContain("SECRETVALUE");
    expect(Buffer.from(d.value, "base64url").toString()).not.toMatch(/secretvalue/i);
    expect(decideAttributionCookie({ ...base, searchParams: q("gclid=abc") })).toMatchObject({ touch: { clickIdKind: "gclid" } });
    expect(decideAttributionCookie({ ...base, searchParams: q("ttclid=abc") })).toMatchObject({ touch: { clickIdKind: "ttclid" } });
  });

  it("đặt cookie khi referrer ngoài site; bỏ qua referrer nội bộ / www / SSO", () => {
    const ext = decideAttributionCookie({ ...base, referer: "https://www.google.com/search?q=lms" });
    expect(ext).toMatchObject({ action: "set", touch: { referrerHost: "www.google.com", utmSource: null } });
    for (const ref of ["https://limio.vn/signin", "https://www.limio.vn/", "https://accounts.google.com/o/oauth2/auth", "https://checkout.stripe.com/c/pay"]) {
      expect(decideAttributionCookie({ ...base, referer: ref }), ref).toEqual({ action: "skip", reason: "no_signal" });
    }
  });

  it("không bao giờ ghi đè cookie hợp lệ (first touch wins); cookie hỏng thì ghi", () => {
    const first = decideAttributionCookie({ ...base, searchParams: q("utm_source=first") });
    if (first.action !== "set") throw new Error("expected set");
    expect(
      decideAttributionCookie({ ...base, searchParams: q("utm_source=second"), existingCookie: first.value }),
    ).toEqual({ action: "skip", reason: "has_cookie" });
    expect(
      decideAttributionCookie({ ...base, searchParams: q("utm_source=second"), existingCookie: "garbage" }).action,
    ).toBe("set");
  });

  it("chỉ GET, chỉ trang; bỏ API / asset / prefetch / sub-resource", () => {
    const withUtm = { ...base, searchParams: q("utm_source=x") };
    expect(decideAttributionCookie({ ...withUtm, method: "POST" })).toEqual({ action: "skip", reason: "not_get" });
    expect(decideAttributionCookie({ ...withUtm, method: "HEAD" })).toEqual({ action: "skip", reason: "not_get" });
    expect(decideAttributionCookie({ ...withUtm, pathname: "/api/auth/session" })).toEqual({ action: "skip", reason: "not_page" });
    expect(decideAttributionCookie({ ...withUtm, pathname: "/_next/static/a.css" })).toEqual({ action: "skip", reason: "not_page" });
    expect(decideAttributionCookie({ ...withUtm, pathname: "/favicon.ico" })).toEqual({ action: "skip", reason: "not_page" });
    expect(decideAttributionCookie({ ...withUtm, pathname: "/logo.png" })).toEqual({ action: "skip", reason: "not_page" });
    expect(decideAttributionCookie({ ...withUtm, isPrefetch: true })).toEqual({ action: "skip", reason: "prefetch" });
    expect(decideAttributionCookie({ ...withUtm, secFetchDest: "image" })).toEqual({ action: "skip", reason: "not_document" });
    expect(decideAttributionCookie({ ...withUtm, secFetchDest: "document" }).action).toBe("set");
  });

  it("không có tín hiệu ⇒ bỏ qua (kể cả utm rỗng / click id rỗng)", () => {
    expect(decideAttributionCookie(base)).toEqual({ action: "skip", reason: "no_signal" });
    expect(decideAttributionCookie({ ...base, searchParams: q("utm_source=&fbclid=&foo=bar") })).toEqual({ action: "skip", reason: "no_signal" });
    expect(decideAttributionCookie({ ...base, searchParams: q("utm_source=%3C%3E") })).toEqual({ action: "skip", reason: "no_signal" });
  });

  it("che đoạn nhạy cảm trong landingPath và không lưu query string", () => {
    const d = decideAttributionCookie({ ...base, pathname: "/join/ABC123", searchParams: q("utm_source=x&token=SECRET") });
    if (d.action !== "set") throw new Error("expected set");
    expect(d.touch.landingPath).toBe("/join");
    expect(Buffer.from(d.value, "base64url").toString()).not.toMatch(/secret|abc123/i);
  });
});

describe("attributionCookieOptions", () => {
  it("HttpOnly, SameSite=Lax, Path=/, 90 ngày, Secure theo giao thức", () => {
    expect(attributionCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7776000,
      secure: true,
    });
    expect(attributionCookieOptions(false).secure).toBe(false);
    expect(ATTRIBUTION_COOKIE).toBe("limio_attr");
  });
});
