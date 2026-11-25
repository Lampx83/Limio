import { describe, expect, it } from "vitest";
import { bundleCheckoutGate, courseCheckoutGate } from "./checkoutGate";

const base = {
  slug: "hsk-4-quyen-1",
  userId: "u1",
  course: { status: "published", enrollMode: "open", priceCents: null as number | null },
  paymentEnabled: true,
  planCount: 1,
  enrolled: false,
};

describe("courseCheckoutGate", () => {
  it("khoá có gói, người mua đã đăng nhập, chưa có quyền → hiện trang", () => {
    expect(courseCheckoutGate(base)).toEqual({ kind: "ok" });
  });
  it("giá phẳng không có gói cũng mua được", () => {
    expect(courseCheckoutGate({ ...base, planCount: 0, course: { ...base.course, priceCents: 199000 } })).toEqual({ kind: "ok" });
  });
  it("không có khoá → 404", () => {
    expect(courseCheckoutGate({ ...base, course: null })).toEqual({ kind: "notFound" });
  });
  it("nháp, chỉ mời, miễn phí, thanh toán tắt → về trang khoá", () => {
    const to = { kind: "redirect", to: "/catalog/hsk-4-quyen-1" };
    expect(courseCheckoutGate({ ...base, course: { ...base.course, status: "draft" } })).toEqual(to);
    expect(courseCheckoutGate({ ...base, course: { ...base.course, enrollMode: "invite_only" } })).toEqual(to);
    expect(courseCheckoutGate({ ...base, planCount: 0 })).toEqual(to);
    expect(courseCheckoutGate({ ...base, paymentEnabled: false })).toEqual(to);
  });
  it("chưa đăng nhập → đăng nhập rồi quay lại đúng trang thanh toán", () => {
    expect(courseCheckoutGate({ ...base, userId: null })).toEqual({
      kind: "redirect",
      to: "/signin?callbackUrl=%2Fcheckout%2Fhsk-4-quyen-1",
    });
  });
  it("đã có quyền học vô thời hạn → vào học, không bán lại", () => {
    expect(courseCheckoutGate({ ...base, enrolled: true })).toEqual({ kind: "redirect", to: "/learn/hsk-4-quyen-1" });
    expect(courseCheckoutGate({ ...base, enrolled: true, accessLimited: false })).toEqual({ kind: "redirect", to: "/learn/hsk-4-quyen-1" });
  });
  it("quyền học có hạn → vào trang thanh toán để gia hạn", () => {
    expect(courseCheckoutGate({ ...base, enrolled: true, accessLimited: true })).toEqual({ kind: "ok" });
  });
  it("khoá không mua được thì không đòi đăng nhập trước", () => {
    expect(courseCheckoutGate({ ...base, userId: null, planCount: 0 })).toEqual({ kind: "redirect", to: "/catalog/hsk-4-quyen-1" });
  });
});

describe("bundleCheckoutGate", () => {
  const b = { slug: "hsk-4-tron-bo", userId: "u1", bundle: { purchasable: true, currency: "VND" }, paymentEnabled: true };
  it("mua được → hiện trang", () => expect(bundleCheckoutGate(b)).toEqual({ kind: "ok" }));
  it("không có combo → 404", () => expect(bundleCheckoutGate({ ...b, bundle: null })).toEqual({ kind: "notFound" }));
  it("chưa mua được / khác VND / thanh toán tắt → về trang combo", () => {
    const to = { kind: "redirect", to: "/combo/hsk-4-tron-bo" };
    expect(bundleCheckoutGate({ ...b, bundle: { purchasable: false, currency: "VND" } })).toEqual(to);
    expect(bundleCheckoutGate({ ...b, bundle: { purchasable: true, currency: "USD" } })).toEqual(to);
    expect(bundleCheckoutGate({ ...b, paymentEnabled: false })).toEqual(to);
  });
  it("chưa đăng nhập → đăng nhập rồi quay lại trang thanh toán combo", () => {
    expect(bundleCheckoutGate({ ...b, userId: null })).toEqual({
      kind: "redirect",
      to: "/signin?callbackUrl=%2Fcheckout%2Fcombo%2Fhsk-4-tron-bo",
    });
  });
});
