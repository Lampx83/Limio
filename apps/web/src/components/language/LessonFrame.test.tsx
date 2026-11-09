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

import LessonFrameLayout, { LessonCrumbs, LessonFooter, LessonViewTabs } from "./LessonFrame";

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
  ...o,
});

const render = (f = frame(), hasExams = false) =>
  renderToStaticMarkup(
    <LessonFrameLayout slug="ielts" courseTitle="Active Skills" lessonTitle="Reading Skill" frame={f} hasExams={hasExams}>
      <main>NỘI DUNG BÀI</main>
    </LessonFrameLayout>,
  );

describe("LessonFrameLayout — thanh bài trong Unit", () => {
  it("có link Về lộ trình, tên Unit, 'x / y bài hoàn thành', và bọc đúng nội dung của trang bài", () => {
    const html = render();
    const t = text(html);
    expect(html).toContain('href="/language?course=ielts"');
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
    expect(html).toMatch(/<aside[^>]*class="hidden lg:block"/);
    expect(text(html)).toContain("Bài trong unit · 1 / 4");
  });
});

describe("LessonCrumbs", () => {
  it("Học / Khoá / Unit / Bài, bài hiện tại không phải link", () => {
    const html = renderToStaticMarkup(<LessonCrumbs slug="ielts" courseTitle="Active Skills" unitTitle="Unit 3" lessonTitle="Reading Skill" />);
    expect(text(html)).toContain("Học / Active Skills / Unit 3 / Reading Skill");
    expect(html).toContain('href="/language"');
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

describe("LessonFooter", () => {
  it("có bài kế: 'Tiếp theo: …' và nút Bài tập tiếp theo tới đúng bài", () => {
    const html = renderToStaticMarkup(<LessonFooter slug="ielts" next={{ id: "l3", title: "Reading Comprehension" }} />);
    expect(text(html)).toContain("Tiếp theo: Reading Comprehension");
    expect(html).toContain('href="/learn/ielts/lessons/l3"');
    expect(text(html)).toContain("Bài tập tiếp theo →");
  });
  it("bài cuối: nút thành Về lộ trình", () => {
    const html = renderToStaticMarkup(<LessonFooter slug="ielts" next={null} />);
    expect(text(html)).toContain("Về lộ trình");
    expect(text(html)).not.toContain("Bài tập tiếp theo");
    expect(html).toContain('href="/language?course=ielts"');
  });
});
