import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LessonFrameData } from "@feedbackme/core-lms";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Panel phải (AI + Ghi chú) dùng API/streaming nên thay bằng khung rỗng khi chỉ kiểm bố cục tĩnh.
vi.mock("@/components/AiTutorPanel", () => ({ default: () => null }));
vi.mock("@/components/LessonActions", () => ({ LessonNotes: () => null }));

import LessonFrameLayout, { LessonCrumbs, LessonNavBar, LessonViewTabs } from "./LessonFrame";

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const frame = (o: Partial<LessonFrameData> = {}): LessonFrameData => ({
  unitTitle: "Endangered Species",
  unitDone: 1,
  unitTotal: 4,
  items: [
    { id: "l1", title: "Before You Read", minutes: 9, state: "done" },
    { id: "l2", title: "Reading Skill", minutes: 12, state: "current" },
    { id: "l3", title: "Reading Comprehension", minutes: null, state: "todo" },
    { id: "l4", title: "Vocabulary Skill", minutes: 7, state: "locked" },
  ],
  next: { id: "l3", title: "Reading Comprehension" },
  prev: { id: "l1", title: "Before You Read" },
  ...o,
});

const render = (f = frame(), hasExams = false, levelLabel = "Unit", notesCount = 0) =>
  renderToStaticMarkup(
    <LessonFrameLayout
      slug="ielts"
      lessonId="l2"
      courseTitle="Active Skills"
      lessonTitle="Reading Skill"
      frame={f}
      hasExams={hasExams}
      levelLabel={levelLabel}
      notesCount={notesCount}
    >
      <main>NỘI DUNG BÀI</main>
    </LessonFrameLayout>,
  );

describe("LessonFrameLayout — thanh bài trong Unit/Module", () => {
  it("có link Về khoá học, tên Unit, 'x / y bài hoàn thành', và bọc đúng nội dung của trang bài", () => {
    const html = render();
    const t = text(html);
    expect(html).toContain('href="/learn/ielts"');
    expect(t).toContain("Endangered Species");
    expect(t).toContain("1 / 4 bài hoàn thành");
    expect(t).toContain("NỘI DUNG BÀI");
  });

  it("từng dòng: số phút chỉ khi có, trạng thái chữ cho bài đã xong/khoá, bài đang xem có aria-current", () => {
    const html = render();
    const t = text(html);
    expect(t).toContain("9 phút");
    expect(t).toContain("12 phút");
    expect(t).not.toContain("null phút");
    expect(t).toContain("Đã xong");
    expect(t).toContain("Đang khoá");
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?Reading Skill/);
  });

  it("bài khoá hiện nhưng KHÔNG có đường dẫn; bài mở được có đường dẫn tới bài", () => {
    const html = render();
    expect(html).toContain('href="/learn/ielts/lessons/l3"');
    expect(html).not.toContain('href="/learn/ielts/lessons/l4"');
    expect(html).toContain('aria-disabled="true"');
  });

  it("'Sẵn sàng vận dụng? Luyện đề' chỉ khi khoá có đề, trỏ tới mục Luyện thi của khoá", () => {
    expect(text(render(frame(), false))).not.toContain("Sẵn sàng vận dụng");
    const html = render(frame(), true);
    expect(text(html)).toContain("Sẵn sàng vận dụng?");
    expect(html).toContain('href="/learn/ielts#luyen-thi"');
  });

  it("dưới lg có khối mở/đóng 'Bài trong unit', từ lg có thanh bên (đúng breakpoint §4.6)", () => {
    const html = render();
    expect(html).toContain("lg:hidden");
    expect(html).toMatch(/<aside[^>]*class="hidden [^"]*lg:block"/);
    expect(text(html)).toContain("Bài trong unit · 1 / 4");
  });

  it("nhãn cấp trên bài theo khoá: UNIT ở khoá ngoại ngữ, MODULE ở khoá khác (rail, khối thu gọn và aria-label)", () => {
    const unit = render(frame(), false, "Unit");
    expect(text(unit)).toContain("Unit");
    expect(unit).toContain('aria-label="Bài trong unit"');
    const mod = render(frame(), false, "Module");
    expect(text(mod)).toContain("Module");
    expect(text(mod)).toContain("Bài trong module · 1 / 4");
    expect(mod).toContain('aria-label="Bài trong module"');
    expect(mod).not.toContain("Bài trong unit");
  });

  it("có panel phải với hai tab AI trợ giảng và Ghi chú (kèm số ghi chú), panel ẩn cho tới khi mở; thanh Bài trước/Bài tiếp theo ở cuối cột nội dung", () => {
    const html = render(frame(), false, "Module", 2);
    expect(html).toContain('role="tablist"');
    expect(text(html)).toContain("AI trợ giảng");
    expect(text(html)).toContain("Ghi chú · 2");
    expect(html).toMatch(/<aside[^>]*aria-label="Trợ giảng AI và ghi chú"[^>]*hidden/);
    expect(html).toContain('aria-label="Mở trợ giảng AI và ghi chú"');
    expect(html).toContain('aria-label="Chuyển bài"');
    expect(html.indexOf("NỘI DUNG BÀI")).toBeLessThan(html.indexOf('aria-label="Chuyển bài"'));
  });

  it("không có ghi chú thì tab chỉ ghi 'Ghi chú' (không hiện số 0)", () => {
    expect(text(render(frame(), false, "Module", 0))).not.toContain("Ghi chú · 0");
  });
});

describe("LessonCrumbs", () => {
  it("Học / Khoá / Unit / Bài, bài hiện tại không phải link", () => {
    const html = renderToStaticMarkup(<LessonCrumbs slug="ielts" courseTitle="Active Skills" unitTitle="Unit 3" lessonTitle="Reading Skill" />);
    expect(text(html)).toContain("Học / Active Skills / Unit 3 / Reading Skill");
    expect(html).toContain('href="/me/dashboard"');
    expect(html).toContain('href="/learn/ielts"');
    expect(html).toMatch(/<span aria-current="page"[^>]*>Reading Skill<\/span>/);
  });
});

describe("LessonViewTabs", () => {
  it("không có từ vựng thì không dựng tab", () => {
    expect(renderToStaticMarkup(<LessonViewTabs slug="s" lessonId="l" view="lesson" vocabCount={0} />)).toBe("");
  });
  it("có từ vựng: hai tab, Từ vựng kèm số từ, tab hiện tại có aria-current, link đúng", () => {
    const html = renderToStaticMarkup(<LessonViewTabs slug="s" lessonId="l" view="vocab" vocabCount={8} />);
    expect(text(html)).toContain("Bài học");
    expect(text(html)).toContain("Từ vựng · 8");
    expect(html).toContain('href="/learn/s/lessons/l"');
    expect(html).toContain('href="/learn/s/lessons/l?view=vocab"');
    expect(html).toMatch(/aria-current="page"[^>]*>Từ vựng · 8/);
  });
});

describe("LessonNavBar", () => {
  it("có cả bài trước và bài kế: hai liên kết đúng bài, nhãn 'Bài trước' / 'Bài tiếp theo'", () => {
    const html = renderToStaticMarkup(
      <LessonNavBar slug="ielts" prev={{ id: "l1", title: "Before You Read" }} next={{ id: "l3", title: "Reading Comprehension" }} />,
    );
    expect(text(html)).toContain("Bài trước");
    expect(text(html)).toContain("Bài tiếp theo");
    expect(html).toContain('href="/learn/ielts/lessons/l1"');
    expect(html).toContain('href="/learn/ielts/lessons/l3"');
    expect(html).toContain("sticky bottom-0");
  });
  it("bài đầu tiên: không có 'Bài trước'", () => {
    const html = renderToStaticMarkup(<LessonNavBar slug="ielts" prev={null} next={{ id: "l3", title: "Reading Comprehension" }} />);
    expect(text(html)).not.toContain("Bài trước");
    expect(text(html)).toContain("Bài tiếp theo");
  });
  it("bài cuối: 'Bài tiếp theo' thành 'Về khoá học'", () => {
    const html = renderToStaticMarkup(<LessonNavBar slug="ielts" prev={{ id: "l1", title: "A" }} next={null} />);
    expect(text(html)).toContain("Về khoá học");
    expect(text(html)).not.toContain("Bài tiếp theo");
    expect(html).toContain('href="/learn/ielts"');
  });
  it("tên bài dài được rút gọn", () => {
    const long = "Tên bài rất rất dài ".repeat(6);
    const html = renderToStaticMarkup(<LessonNavBar slug="s" prev={null} next={{ id: "n", title: long }} />);
    expect(text(html)).toContain("…");
  });
});
