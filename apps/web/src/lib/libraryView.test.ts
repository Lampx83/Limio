import { describe, expect, it } from "vitest";
import type { LibraryQuery } from "@feedbackme/core-lms";
import { hasLibraryFilter, libraryByline, libraryHref, libraryPriceLabel } from "./libraryView";

const base: LibraryQuery = { q: "", publisher: "", level: "", focus: "", tab: "all", sort: "relevant", page: 1 };

describe("libraryHref", () => {
  it("giá trị mặc định không vào URL: một dạng chuẩn", () => {
    expect(libraryHref(base)).toBe("/language/thu-vien");
    expect(libraryHref({ ...base, tab: "saved" })).toBe("/language/thu-vien?tab=saved");
  });
  it("giữ bộ lọc hiện tại khi đổi tab, và đổi bộ lọc thì về trang 1", () => {
    const q: LibraryQuery = { ...base, q: "oxford", publisher: "Oxford", page: 3 };
    expect(libraryHref(q, { tab: "saved" })).toBe("/language/thu-vien?q=oxford&publisher=Oxford&tab=saved");
    expect(libraryHref(q, { page: 4 })).toBe("/language/thu-vien?q=oxford&publisher=Oxford&page=4");
  });
  it("bỏ một bộ lọc bằng null hoặc chuỗi rỗng; mã hoá ký tự đặc biệt", () => {
    const q: LibraryQuery = { ...base, q: "a&b c", level: "B1-B2" };
    expect(libraryHref(q, { level: null })).toBe("/language/thu-vien?q=a%26b+c");
    expect(libraryHref(q, { q: "" })).toBe("/language/thu-vien?level=B1-B2");
  });
  it("sắp xếp khác mặc định có trong URL", () => {
    expect(libraryHref({ ...base, sort: "name" })).toBe("/language/thu-vien?sort=name");
  });
});

describe("hasLibraryFilter", () => {
  it("chỉ tính tìm kiếm và 3 bộ lọc, không tính tab/sắp xếp/trang", () => {
    expect(hasLibraryFilter({ ...base, tab: "saved", sort: "name", page: 2 })).toBe(false);
    expect(hasLibraryFilter({ ...base, focus: "reading" })).toBe(true);
    expect(hasLibraryFilter({ ...base, q: "x" })).toBe(true);
  });
});

describe("libraryPriceLabel — cùng quy tắc với /catalog", () => {
  const free = { priceCents: null, currency: "VND", cheapestPlan: null };
  it("miễn phí khi không giá, hoặc khi cổng thanh toán tắt", () => {
    expect(libraryPriceLabel(free, true)).toBe("Miễn phí");
    expect(libraryPriceLabel({ priceCents: 500000, currency: "VND", cheapestPlan: null }, false)).toBe("Miễn phí");
  });
  it("có gói thì 'Từ …', giá phẳng thì giá đó", () => {
    expect(libraryPriceLabel({ ...free, cheapestPlan: { priceCents: 299000, currency: "VND" } }, true)).toMatch(/^Từ 299\.000/);
    expect(libraryPriceLabel({ priceCents: 199000, currency: "VND", cheapestPlan: null }, true)).toMatch(/^199\.000/);
  });
});

describe("libraryByline", () => {
  it("bỏ phần trống", () => {
    expect(libraryByline({ publisher: "NGL", authors: null, edition: "Third Edition" })).toBe("NGL · Third Edition");
    expect(libraryByline({ publisher: null, authors: null, edition: null })).toBe("");
  });
});
