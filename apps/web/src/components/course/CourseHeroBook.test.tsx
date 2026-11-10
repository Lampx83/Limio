import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CourseBookLine, CourseHeroCover } from "./CourseHeroBook";

describe("CourseBookLine (AC1)", () => {
  it("đủ ba trường: một dòng 'Nhà xuất bản · Tác giả · Lần xuất bản'", () => {
    const html = renderToStaticMarkup(<CourseBookLine publisher="National Geographic Learning" authors="Neil J Anderson" edition="Third Edition" />);
    expect(html).toContain("National Geographic Learning · Neil J Anderson · Third Edition");
  });

  it("thiếu trường nào thì bỏ trường đó, không có dấu '·' thừa", () => {
    expect(renderToStaticMarkup(<CourseBookLine publisher="NGL" authors={null} edition="3rd" />)).toContain("NGL · 3rd");
    const one = renderToStaticMarkup(<CourseBookLine publisher={null} authors="Neil J Anderson" edition={null} />);
    expect(one).toContain("Neil J Anderson");
    expect(one).not.toContain("·");
  });

  it("cả ba trống thì không dựng gì (không chừa khoảng trống)", () => {
    expect(renderToStaticMarkup(<CourseBookLine publisher={null} authors={null} edition={null} />)).toBe("");
    expect(renderToStaticMarkup(<CourseBookLine publisher="  " authors="" edition={null} />)).toBe("");
  });
});

describe("CourseHeroCover (AC2)", () => {
  it("có ảnh: dựng ảnh trang trí (alt rỗng), ẩn dưới lg và hiện từ lg", () => {
    const html = renderToStaticMarkup(<CourseHeroCover url="/api/course-covers/c1-aabbccddeeff.jpg" />);
    expect(html).toContain('src="/api/course-covers/c1-aabbccddeeff.jpg"');
    expect(html).toContain('alt=""');
    expect(html).toMatch(/class="hidden [^"]*lg:block"/);
  });

  it("không có ảnh: không dựng gì", () => {
    expect(renderToStaticMarkup(<CourseHeroCover url={null} />)).toBe("");
  });
});
