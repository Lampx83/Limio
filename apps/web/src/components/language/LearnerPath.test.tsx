import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LanguageLearnerPath } from "@feedbackme/core-lms";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import LearnerPath, { UNITS_SHOWN } from "./LearnerPath";

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

function path(over: Partial<LanguageLearnerPath> = {}): LanguageLearnerPath & { selected: NonNullable<LanguageLearnerPath["selected"]> } {
  return {
    courses: [{ id: "c1", slug: "ielts", title: "IELTS Reading" }],
    selected: { id: "c1", slug: "ielts", title: "IELTS Reading", completionPct: 24 },
    continue: { lessonId: "l1", lessonTitle: "Endangered Species", unitTitle: "Unit 3", minutes: 12 },
    units: [
      { id: "u1", title: "Unit 1: Travel", done: 3, total: 3, state: "done" },
      { id: "u2", title: "Unit 2: Fashion", done: 1, total: 3, state: "learning" },
      { id: "u3", title: "Unit 3: Animals", done: 0, total: 2, state: "todo" },
    ],
    skills: [
      { skill: "reading", done: 2, total: 4, pct: 50 },
      { skill: "listening", done: 1, total: 4, pct: 25 },
    ],
    ...over,
  } as never;
}
const render = (p = path(), o: Partial<Parameters<typeof LearnerPath>[0]> = {}) =>
  renderToStaticMarkup(<LearnerPath userName="Diệp Anh" path={p} goal={null} dueCards={0} hasExams={false} {...o} />);

describe("LearnerPath — đợt 1", () => {
  it("hero: tên bài, Unit, số phút, nút tới đúng bài", () => {
    const html = render();
    const t = text(html);
    expect(t).toContain("Endangered Species");
    expect(t).toContain("Unit 3 · 12 phút");
    expect(html).toContain('href="/learn/ielts/lessons/l1"');
  });

  it("không có số phút thì không ghi phút", () => {
    const t = text(render(path({ continue: { lessonId: "l1", lessonTitle: "A", unitTitle: "U", minutes: null } })));
    expect(t).not.toContain("phút");
  });

  it("học hết thì hero báo đã học hết và không có nút Tiếp tục bài học", () => {
    const t = text(render(path({ continue: null })));
    expect(t).toContain("đã học hết");
    expect(t).not.toContain("Tiếp tục bài học");
  });

  it("Unit: x / y bài · trạng thái cho từng dòng", () => {
    const t = text(render());
    expect(t).toContain("3 / 3 bài · Hoàn thành");
    expect(t).toContain("1 / 3 bài · Đang học");
    expect(t).toContain("0 / 2 bài · Chưa học");
  });

  it("chỉ hiện 5 Unit đầu và có 'Xem tất cả n unit' khi còn nữa", () => {
    const units = Array.from({ length: 8 }, (_, i) => ({ id: `u${i}`, title: `Unit ${i + 1}`, done: 0, total: 1, state: "todo" as const }));
    const t = text(render(path({ units })));
    expect(UNITS_SHOWN).toBe(5);
    expect(t).toContain("Unit 5");
    expect(t).not.toContain("Unit 6");
    expect(t).toContain("Xem tất cả 8 unit");
    expect(text(render())).not.toContain("Xem tất cả");
  });

  it("kỹ năng: hiện % và chú thích 'Dựa trên bài học đã hoàn thành'; không có kỹ năng thì ẩn cả khối", () => {
    const t = text(render());
    expect(t).toContain("Đọc");
    expect(t).toContain("50%");
    expect(t).toContain("Nghe");
    expect(t).toContain("Dựa trên bài học đã hoàn thành");
    expect(text(render(path({ skills: [] })))).not.toContain("Tiến độ theo kỹ năng");
  });

  it("mục tiêu: chỉ hiện khi có; không có 'Dự kiến đạt'", () => {
    expect(text(render())).not.toContain("Mục tiêu của bạn");
    const t = text(render(path(), { goal: { level: "IELTS 6.5", targetDate: "22/12/2026", hoursPerWeek: 4 } }));
    expect(t).toContain("IELTS 6.5");
    expect(t).toContain("Hạn 22/12/2026 · 4 giờ/tuần");
    expect(t).toContain("24% bài học của khoá đã hoàn thành");
    expect(t).not.toContain("Dự kiến đạt");
  });

  it("ôn lại: có thẻ đến hạn thì có nút tới flashcards; không có thì báo không có thẻ; không nhắc ngữ pháp", () => {
    const due = render(path(), { dueCards: 8 });
    expect(text(due)).toContain("8 từ vựng");
    expect(due).toContain('href="/learn/ielts/flashcards"');
    const none = text(render());
    expect(none).toContain("Hôm nay không có thẻ nào đến hạn");
    expect(none).not.toContain("ngữ pháp");
  });

  it("Luyện đề: tab và thẻ chỉ hiện khi khoá có đề, trỏ tới mục Luyện thi của trang khoá", () => {
    expect(text(render())).not.toContain("Luyện đề");
    const html = render(path(), { hasExams: true });
    expect(text(html)).toContain("Luyện đề");
    expect(html).toContain('href="/learn/ielts#luyen-thi"');
  });

  it("chọn khoá: chỉ hiện khi có từ hai khoá", () => {
    expect(render()).not.toContain("/language?course=");
    const two = path({ courses: [{ id: "c1", slug: "ielts", title: "IELTS Reading" }, { id: "c2", slug: "toeic", title: "TOEIC" }] });
    expect(render(two)).toContain("/language?course=toeic");
  });

  it("không lộ số mastery", () => {
    expect(render(path(), { dueCards: 3, goal: { level: "IELTS 6", targetDate: "01/01/2027", hoursPerWeek: null } })).not.toMatch(/mastery/i);
  });
});
