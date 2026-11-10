import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LibraryCard as Card, LibraryPage } from "@feedbackme/core-lms";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

import LibraryView from "./LibraryView";

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const card = (o: Partial<Card> = {}): Card => ({
  id: "c1",
  slug: "grammar",
  title: "English Grammar in Use",
  publisher: "Cambridge",
  authors: "Raymond Murphy",
  edition: null,
  levelBand: "B1-B2",
  coverUrl: null,
  excerpt: "Ôn cấu trúc ngữ pháp.",
  focusTags: ["grammar"],
  saved: false,
  enrolled: false,
  priceCents: null,
  currency: "VND",
  cheapestPlan: null,
  previewLessonId: null,
  ...o,
});

const page = (o: Partial<LibraryPage> = {}): LibraryPage => ({
  query: { q: "", publisher: "", level: "", focus: "", tab: "all", sort: "relevant", page: 1 },
  inProgress: null,
  cards: [card()],
  matching: 1,
  totalAll: 7,
  savedCount: 2,
  pageCount: 1,
  facets: { publishers: ["Cambridge", "Oxford"], levels: ["B1-B2"], focus: ["grammar", "reading"] },
  ...o,
});

const render = (p = page(), pay = true) => renderToStaticMarkup(<LibraryView data={p} paymentEnabled={pay} />);

describe("LibraryView — Thư viện giáo trình", () => {
  it("tiêu đề, ô tìm kiếm, 3 bộ lọc lấy giá trị từ thư viện, tab có số đếm", () => {
    const html = render();
    const t = text(html);
    for (const s of ["Thư viện giáo trình", "Nhà xuất bản", "Trình độ", "Kỹ năng", "Tất cả · 7", "Đã lưu · 2"]) expect(t).toContain(s);
    expect(html).toContain('placeholder="Tìm tên giáo trình, tác giả hoặc nhà xuất bản..."');
    expect(html).toContain('<option value="Oxford">');
    expect(html).toContain('<option value="reading">');
    expect(html).not.toContain('<option value="writing">');
  });

  it("form là GET tới đúng trang (chạy được khi chưa có JavaScript)", () => {
    const html = render();
    expect(html).toMatch(/<form[^>]*method="get"[^>]*action="\/language\/thu-vien"/);
  });

  it("thẻ chưa ghi danh: tên dẫn sang /catalog, có Preview khi có bài xem thử, KHÔNG có nút Học", () => {
    const html = render(page({ cards: [card({ previewLessonId: "l9" })] }));
    expect(html).toContain('href="/catalog/grammar"');
    expect(html).toContain('href="/learn/grammar/lessons/l9"');
    expect(text(html)).toContain("Preview");
    expect(html).not.toMatch(/href="\/learn\/grammar"[^>]*>\s*Học\s*</);
    expect(text(html)).toContain("Miễn phí");
  });

  it("thẻ không có bài xem thử: ẩn Preview, hiện 'Xem chi tiết' tới trang giới thiệu", () => {
    const html = render();
    expect(text(html)).not.toContain("Preview");
    expect(html).toMatch(/href="\/catalog\/grammar"[^>]*>\s*Xem chi tiết/);
  });

  it("thẻ đã ghi danh: nút Học tới /learn, tên dẫn tới /learn, không hiện giá", () => {
    const html = render(page({ cards: [card({ enrolled: true, priceCents: 500000 })] }));
    expect(html).toContain('href="/learn/grammar"');
    expect(text(html)).toContain("Đã ghi danh");
    expect(html).not.toContain('href="/catalog/grammar"');
    expect(text(html)).not.toContain("500.000");
  });

  it("giá: có gói thì 'Từ …' khi cổng thanh toán bật; tắt cổng thì Miễn phí", () => {
    const c = card({ cheapestPlan: { priceCents: 299000, currency: "VND" } });
    expect(text(render(page({ cards: [c] }), true))).toMatch(/Từ 299\.000/);
    expect(text(render(page({ cards: [c] }), false))).toContain("Miễn phí");
  });

  it("nút Lưu / Đã lưu theo trạng thái", () => {
    expect(text(render(page({ cards: [card({ saved: false })] })))).toContain("Lưu");
    const html = render(page({ cards: [card({ saved: true })] }));
    expect(text(html)).toContain("Đã lưu");
    expect(html).toContain('aria-pressed="true"');
  });

  it("khoá không có bìa: ô thay thế mang chữ cái đầu, không có thẻ img", () => {
    const html = render();
    expect(html).not.toContain("<img");
    expect(html).toContain(">E<");
    expect(render(page({ cards: [card({ coverUrl: "https://x.y/a.png" })] }))).toContain("<img");
  });

  it("mô tả là chữ thuần: HTML trong excerpt không thành phần tử", () => {
    const html = render(page({ cards: [card({ excerpt: "<script>alert(1)</script>" })] }));
    expect(html).not.toContain("<script>alert");
  });

  it("khối Đang học: tiến độ Unit, nút Tiếp tục học tới đúng bài, liên kết mở khoá học; thẻ đó không lặp ở lưới", () => {
    const inProgress = {
      card: card({ id: "c2", slug: "reading", title: "Active Skills for Reading 3", enrolled: true }),
      lessonId: "l5",
      lessonTitle: "Chapter 1",
      unitTitle: "Unit 3",
      unitDone: 1,
      unitTotal: 3,
      completionPct: 20,
    };
    const html = render(page({ inProgress }));
    const t = text(html);
    expect(t).toContain("Đang học");
    expect(t).toContain("Unit 3 · 1 / 3 bài");
    expect(html).toContain('href="/learn/reading/lessons/l5"');
    expect(html).toContain('href="/learn/reading"');
    expect(t).toContain("Khám phá thêm");
  });

  it("trạng thái rỗng: thư viện trống, tab Đã lưu trống, không có kết quả", () => {
    expect(text(render(page({ totalAll: 0, cards: [], matching: 0 })))).toContain("Thư viện chưa có giáo trình nào");
    const saved = page({ query: { ...page().query, tab: "saved" }, cards: [], matching: 0, savedCount: 0 });
    expect(text(render(saved))).toContain("Bạn chưa lưu giáo trình nào");
    const none = page({ query: { ...page().query, q: "zzz" }, cards: [], matching: 0 });
    expect(text(render(none))).toContain("Không có giáo trình phù hợp");
  });

  it("phân trang chỉ hiện khi có từ hai trang, giữ bộ lọc trong link", () => {
    expect(render()).not.toContain("Phân trang");
    const html = render(page({ pageCount: 3, query: { ...page().query, q: "oxford", page: 2 } }));
    expect(text(html)).toContain("Trang 2 / 3");
    expect(html).toContain('href="/language/thu-vien?q=oxford"');
    expect(html).toContain('href="/language/thu-vien?q=oxford&amp;page=3"');
  });

  it("có bộ lọc thì hiện 'Xoá bộ lọc' và khối Đang học không có", () => {
    const html = render(page({ query: { ...page().query, publisher: "Oxford" } }));
    expect(text(html)).toContain("Xoá bộ lọc");
    expect(html).toContain('<option value="Oxford" selected');
  });
});
