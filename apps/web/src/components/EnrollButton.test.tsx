import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EnrollButton from "./EnrollButton";

const plans = [
  { id: "p1", label: "1 năm", durationMonths: 12, priceCents: 199000, currency: "VND" },
  { id: "p2", label: "Trọn đời", durationMonths: null, priceCents: 399000, currency: "VND" },
];
const common = { courseId: "c1", slug: "hsk-4-quyen-1", alreadyEnrolled: false, paymentEnabled: true, currency: "VND" };

describe("EnrollButton — khoá có phí ở trang khoá (chế độ gọn)", () => {
  const html = renderToStaticMarkup(
    <EnrollButton {...common} priceCents={null} originalPriceCents={599000} accessPlans={plans} paymentProviders={["sepay_pg"]} />,
  );
  it("chỉ có nút Mua ngay dẫn sang trang thanh toán và liên kết mã kích hoạt", () => {
    expect(html).toContain('href="/checkout/hsk-4-quyen-1"');
    expect(html).toContain("Mua ngay");
    expect(html).toContain('href="/checkout/hsk-4-quyen-1#ma-kich-hoat"');
  });
  it("không còn danh sách gói, nút cổng hay ô nhập mã", () => {
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain("SePay");
    expect(html).not.toContain("<input");
  });
  it("hiện giá thấp nhất kèm giá gốc gạch ngang; hidePrice thì bỏ", () => {
    expect(html).toContain("199.000");
    expect(html).toContain("599.000");
    const hidden = renderToStaticMarkup(<EnrollButton {...common} priceCents={null} accessPlans={plans} hidePrice />);
    expect(hidden).not.toContain("199.000");
    expect(hidden).toContain("Mua ngay");
  });
});

describe("EnrollButton — chế độ thanh toán", () => {
  it("hiện đủ gói và nút cổng đã cấu hình", () => {
    const html = renderToStaticMarkup(
      <EnrollButton {...common} priceCents={null} accessPlans={plans} paymentProviders={["sepay_pg"]} checkoutMode />,
    );
    expect(html).toContain('type="radio"');
    expect(html).toContain("Thanh toán qua SePay");
    expect(html).not.toContain("Mua ngay");
  });
});

describe("EnrollButton — không đổi", () => {
  it("khoá miễn phí vẫn là nút đăng ký, không dẫn sang trang thanh toán", () => {
    const html = renderToStaticMarkup(<EnrollButton {...common} paymentEnabled={false} priceCents={0} />);
    expect(html).not.toContain("/checkout/");
  });
  it("đã ghi danh thì vẫn là nút Vào học", () => {
    const html = renderToStaticMarkup(<EnrollButton {...common} alreadyEnrolled priceCents={null} accessPlans={plans} />);
    expect(html).toContain('href="/learn/hsk-4-quyen-1"');
    expect(html).not.toContain("/checkout/");
  });
});
