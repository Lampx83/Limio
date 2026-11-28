import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LessonPager from "./LessonPager";

const labels = { prev: "Bài trước", next: "Bài tiếp theo", locked: "Bài tiếp theo đang khoá", backToCourse: "Về trang khoá học", endOfCourse: "Bạn đã đến bài cuối của khoá" };
const n = (id: string, over: object = {}) => ({ id, title: `Tiêu đề ${id}`, moduleTitle: "Chủ đề X", locked: false, newModule: false, ...over });
const html = (props: Partial<Parameters<typeof LessonPager>[0]>) => renderToStaticMarkup(<LessonPager slug="hsk-1-goc" prev={null} next={null} labels={labels} {...props} />);

describe("LessonPager", () => {
  it("có bài sau: liên kết tới đúng bài, ghi tên bài", () => {
    const h = html({ next: n("b") });
    expect(h).toContain('href="/learn/hsk-1-goc/lessons/b"');
    expect(h).toContain("Bài tiếp theo");
    expect(h).toContain("Tiêu đề b");
    expect(h).not.toContain("Chủ đề X");
  });
  it("sang chương mới thì ghi tên chương", () => {
    expect(html({ next: n("c", { newModule: true }) })).toContain("Chủ đề X");
  });
  it("có bài trước và bài sau", () => {
    const h = html({ prev: n("a"), next: n("b") });
    expect(h).toContain('href="/learn/hsk-1-goc/lessons/a"');
    expect(h).toContain('href="/learn/hsk-1-goc/lessons/b"');
  });
  it("bài sau đang khoá: không có liên kết tới nó", () => {
    const h = html({ next: n("b", { locked: true }) });
    expect(h).not.toContain("lessons/b");
    expect(h).toContain("Bài tiếp theo đang khoá");
  });
  it("bài cuối: dẫn về trang khoá học", () => {
    const h = html({ prev: n("a") });
    expect(h).toContain('href="/learn/hsk-1-goc"');
    expect(h).toContain("Về trang khoá học");
  });
  it("giảng viên xem thử: liên kết giữ preview=1", () => {
    expect(html({ next: n("b"), preview: true })).toContain("preview=1");
  });
});
