import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let mockPath = "/language/exams";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ prefetch: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

import LanguageLeftMenu from "./LanguageLeftMenu";

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const render = (p: Partial<React.ComponentProps<typeof LanguageLeftMenu>> = {}) =>
  renderToStaticMarkup(<LanguageLeftMenu role="teacher" {...p} />);

describe("LanguageLeftMenu (L2)", () => {
  it("L2.2: giảng viên thấy menu rút gọn, không có các nhóm của LMS thường", () => {
    const t = text(render());
    for (const s of ["Tổng quan", "Khoá ngoại ngữ", "Đề thi (thi thử & luyện đề)", "Chờ duyệt / chấm", "Token AI"]) {
      expect(t).toContain(s);
    }
    for (const s of ["Limio-Live", "Vấn đáp", "Đấu trường", "Gameshow"]) expect(t).not.toContain(s);
  });
  it("L2.3: học viên thấy Luyện thi, Hồ sơ kỹ năng, Thẻ ôn từ", () => {
    const t = text(render({ role: "student" }));
    for (const s of ["Khoá của tôi", "Luyện thi", "Hồ sơ kỹ năng", "Thẻ ôn từ"]) expect(t).toContain(s);
    expect(t).not.toContain("Chờ duyệt / chấm");
  });
  it("mục của trang hiện tại có aria-current; /language không sáng ở trang con", () => {
    const html = render();
    const cur = [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>(.*?)<\/a>/g)].map((m) => text(m[1]!).trim());
    expect(cur).toEqual(["Đề thi (thi thử & luyện đề)"]);
  });
  it("L1.3: có nút 'Về Limio' trỏ route đổi chế độ; ở trang /language/* thì về trang chủ (không có trang tương ứng ở vỏ thường)", () => {
    mockPath = "/language/exams";
    const html = render();
    expect(text(html)).toContain("Về Limio");
    expect(html).toContain("/api/app-mode?to=default&amp;next=%2F");
  });
  it("L1.3: ở trang dùng chung (vd /me/skills) thì giữ nguyên trang khi đổi vỏ", () => {
    mockPath = "/me/skills";
    const html = render({ role: "student" });
    expect(html).toContain("/api/app-mode?to=default&amp;next=%2Fme%2Fskills");
    mockPath = "/language/exams";
  });
  it("badge số bài chờ duyệt hiện ở mục tương ứng", () => {
    const t = text(render({ badges: { "/language/review": { count: 7 } } }));
    expect(t).toContain("7");
  });
  it("hiện tên 'Limio Language' làm tiêu đề khu vực", () => {
    expect(text(render())).toContain("Limio Language");
  });
});
