import { describe, expect, it } from "vitest";
import { courseJsonLd, pageMetadata, truncateForMeta } from "./seo";

const base = { slug: "py", title: "Python", description: "Học Python" };

describe("courseJsonLd — giá", () => {
  it("VND lưu thẳng số đồng, không chia 100", () => {
    const ld = courseJsonLd({ ...base, paymentEnabled: true, priceCents: 500_000, currency: "VND" });
    expect(ld.offers.price).toBe("500000");
    expect(ld.offers.priceCurrency).toBe("VND");
  });

  it("tiền tệ khác lưu cent nên chia 100", () => {
    const ld = courseJsonLd({ ...base, paymentEnabled: true, priceCents: 4999, currency: "USD" });
    expect(ld.offers.price).toBe("49.99");
    expect(ld.offers.priceCurrency).toBe("USD");
  });

  it("tắt thanh toán toàn hệ thống thì khoá nào cũng miễn phí", () => {
    const ld = courseJsonLd({ ...base, paymentEnabled: false, priceCents: 4999, currency: "USD" });
    expect(ld.offers.price).toBe("0");
    expect(ld.offers.category).toBe("Free");
  });
});

describe("courseJsonLd — cấu trúc", () => {
  it("khai syllabusSections theo thứ tự module, bỏ qua khi không có", () => {
    expect(courseJsonLd({ ...base, modules: ["A", "B"] }).syllabusSections).toEqual([
      { "@type": "Syllabus", name: "A", position: 1 },
      { "@type": "Syllabus", name: "B", position: 2 },
    ]);
    expect(courseJsonLd(base)).not.toHaveProperty("syllabusSections");
  });

  it("khoá tiếng Anh khai inLanguage en", () => {
    expect(courseJsonLd({ ...base, language: "en" }).inLanguage).toBe("en");
    expect(courseJsonLd(base).inLanguage).toBe("vi-VN");
  });
});

describe("pageMetadata", () => {
  const input = { title: "T", description: "D", path: "/catalog/x" };

  it("noIndex tắt index nhưng vẫn follow", () => {
    const m = pageMetadata({ ...input, noIndex: true });
    expect(m.robots).toMatchObject({ index: false, follow: true });
  });

  it("canonical là URL tuyệt đối của chính trang", () => {
    expect(String(pageMetadata(input).alternates?.canonical)).toMatch(/^https?:\/\/.+\/catalog\/x$/);
  });

  it("locale mặc định vi_VN, ghi đè được cho khoá tiếng Anh", () => {
    expect(pageMetadata(input).openGraph).toMatchObject({ locale: "vi_VN" });
    expect(pageMetadata({ ...input, locale: "en_US" }).openGraph).toMatchObject({ locale: "en_US" });
  });
});

describe("truncateForMeta", () => {
  it("cắt ở ranh giới từ, không vượt quá giới hạn", () => {
    const out = truncateForMeta("một hai ba bốn năm sáu bảy tám chín mười ".repeat(10), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("…")).toBe(true);
  });
});
