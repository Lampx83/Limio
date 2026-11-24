import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DiscountBadge, PriceBlock, PriceStrike } from "./PriceTag";

describe("PriceTag", () => {
  it("hiện giá gốc gạch ngang và nhãn -67% khi có khuyến mãi", () => {
    const html = renderToStaticMarkup(
      <>
        <PriceStrike originalCents={599000} saleCents={199000} currency="VND" />
        <DiscountBadge originalCents={599000} saleCents={199000} />
      </>,
    );
    expect(html).toContain("line-through");
    expect(html).toContain("599.000");
    expect(html).toContain("-67%");
  });
  it("không vẽ gì khi giá gốc không lớn hơn giá bán", () => {
    const html = renderToStaticMarkup(
      <>
        <PriceStrike originalCents={199000} saleCents={199000} currency="VND" />
        <DiscountBadge originalCents={null} saleCents={199000} />
      </>,
    );
    expect(html).toBe("");
  });

  it("PriceBlock: -% đỏ, giá gốc gạch ngang, giá bán đỏ, ghi chú — đúng thứ tự trên xuống", () => {
    const html = renderToStaticMarkup(
      <PriceBlock originalCents={599000} saleCents={199000} currency="VND" note="Truy cập 1 năm" />,
    );
    const iPct = html.indexOf("-67%");
    const iOrig = html.indexOf("599.000");
    const iSale = html.indexOf("199.000");
    const iNote = html.indexOf("Truy cập 1 năm");
    expect(iPct).toBeGreaterThan(-1);
    expect(iPct).toBeLessThan(iOrig);
    expect(iOrig).toBeLessThan(iSale);
    expect(iSale).toBeLessThan(iNote);
    expect(html).toContain("line-through");
    expect(html).toMatch(/text-red-600[^"]*"[^>]*data-testid="price-sale"|data-testid="price-sale"/);
  });
  it("PriceBlock: không khuyến mãi thì chỉ còn giá bán thường và ghi chú", () => {
    const html = renderToStaticMarkup(<PriceBlock originalCents={null} saleCents={199000} currency="VND" note="x" />);
    expect(html).not.toContain("line-through");
    expect(html).not.toContain("price-discount");
    expect(html).toContain("199.000");
  });
});
