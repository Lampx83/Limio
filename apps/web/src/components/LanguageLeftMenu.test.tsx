import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let mockPath = "/language";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ prefetch: () => undefined, push: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

import LanguageLeftMenu from "./LanguageLeftMenu";

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("LanguageLeftMenu — đợt 1 (học viên)", () => {
  it("có hai mục theo Figma và tiêu đề khu vực, không có mục chưa có trang", () => {
    mockPath = "/language";
    const t = text(renderToStaticMarkup(<LanguageLeftMenu />));
    for (const s of ["Limio Language", "Lộ trình của tôi", "Thư viện giáo trình", "Đã lưu & ghi chú", "Lịch ôn tập", "Về Limio"]) expect(t).toContain(s);
    expect(t).not.toContain("Đấu trường");
  });

  it("mục của trang hiện tại có aria-current; /language không sáng ở trang con", () => {
    mockPath = "/language";
    const cur = (h: string) => [...h.matchAll(/<a[^>]*aria-current="page"[^>]*>(.*?)<\/a>/g)].map((m) => text(m[1]!).trim());
    expect(cur(renderToStaticMarkup(<LanguageLeftMenu />))).toEqual(["Lộ trình của tôi"]);
    mockPath = "/language/thu-vien";
    expect(cur(renderToStaticMarkup(<LanguageLeftMenu />))).toEqual(["Thư viện giáo trình"]);
    mockPath = "/me/notes";
    expect(cur(renderToStaticMarkup(<LanguageLeftMenu />))).toEqual(["Đã lưu & ghi chú"]);
    mockPath = "/language";
  });

  it("ở trang /language về Limio thì về trang chủ (trang đó không có ở vỏ thường)", () => {
    mockPath = "/language";
    expect(renderToStaticMarkup(<LanguageLeftMenu />)).toContain("/api/app-mode?to=default&amp;next=%2F");
  });

  it("ở trang dùng chung (vd /me/notes) thì giữ nguyên trang khi đổi vỏ", () => {
    mockPath = "/me/notes";
    expect(renderToStaticMarkup(<LanguageLeftMenu />)).toContain("/api/app-mode?to=default&amp;next=%2Fme%2Fnotes");
    mockPath = "/language";
  });
});
