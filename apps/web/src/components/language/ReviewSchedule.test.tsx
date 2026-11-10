import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ReviewSchedule from "./ReviewSchedule";

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const DAY = 24 * 60 * 60 * 1000;
const D0 = new Date("2026-10-02T17:00:00Z"); // 00:00 giờ VN 03/10/2026
const mkDays = (counts: number[]) => counts.map((count, i) => ({ dayStart: new Date(D0.getTime() + i * DAY).toISOString(), count }));

const base = {
  courses: [{ id: "c1", slug: "ielts", title: "IELTS Reading" }],
  selected: { id: "c1", slug: "ielts", title: "IELTS Reading" },
  dueToday: 0,
  days: mkDays([0, 0, 0, 0, 0, 0, 0]),
  practice: [] as Array<{ examId: string; title: string; wrong: number }>,
  suggestion: null,
};
const render = (o: Partial<Parameters<typeof ReviewSchedule>[0]> = {}) => renderToStaticMarkup(<ReviewSchedule {...base} {...o} />);

describe("ReviewSchedule — Lịch ôn tập", () => {
  it("không còn việc nào: báo 'Hôm nay bạn đã ôn xong', vẫn có khối 7 ngày và nói chưa có thẻ lên lịch", () => {
    const t = text(render());
    expect(t).toContain("Hôm nay bạn đã ôn xong");
    expect(t).toContain("Hôm nay không có thẻ nào đến hạn.");
    expect(t).toContain("Chưa có thẻ nào được lên lịch.");
    expect(t).not.toContain("Câu luyện nên làm lại");
    expect(t).not.toContain("Gợi ý hôm nay");
  });

  it("có thẻ đến hạn: số thẻ, nút tới flashcards của đúng khoá; không báo 'đã ôn xong'", () => {
    const html = render({ dueToday: 6, days: mkDays([6, 0, 2, 0, 0, 0, 1]) });
    expect(text(html)).toContain("6");
    expect(text(html)).toContain("thẻ từ vựng đến hạn ôn");
    expect(html).toContain('href="/learn/ielts/flashcards"');
    expect(text(html)).not.toContain("đã ôn xong");
  });

  it("lịch 7 ngày: nhãn Hôm nay / Ngày mai / ngày theo giờ VN, đủ 7 dòng, số thẻ từng ngày, chú thích quá hạn", () => {
    const html = render({ dueToday: 3, days: mkDays([3, 1, 0, 0, 0, 0, 4]) });
    const t = text(html);
    expect(t).toContain("Hôm nay");
    expect(t).toContain("Ngày mai");
    expect(t).toContain("09/10");
    expect((html.match(/tabular-nums font-semibold/g) ?? []).length).toBe(7);
    expect(t).toContain("thẻ quá hạn tính vào hôm nay");
  });

  it("câu luyện nên làm lại: tên đề, số câu, 'Làm lại' mở sẵn bộ lọc câu sai của đúng đề", () => {
    const html = render({ practice: [{ examId: "e1", title: "Thi thử HSK 3", wrong: 4 }] });
    expect(text(html)).toContain("Câu luyện nên làm lại");
    expect(text(html)).toContain("Thi thử HSK 3");
    expect(text(html)).toContain("4 câu lần trả lời gần nhất chưa đúng");
    expect(html).toContain('href="/learn/ielts/exams/e1/practice?filter=wrong"');
    expect(text(html)).not.toContain("đã ôn xong");
  });

  it("gợi ý hôm nay: nhãn lý do, kỹ năng, tên bài, nút mở đúng bài; không có số mastery", () => {
    const html = render({ suggestion: { skillLabel: "Đọc", lessonId: "l9", lessonTitle: "Reading Skill", reason: "review" } });
    expect(text(html)).toContain("Nên ôn lại kỹ năng Đọc: Reading Skill");
    expect(html).toContain('href="/learn/ielts/lessons/l9"');
    expect(text(html)).not.toMatch(/mastery|\d\s*%/i);
    expect(text(html)).not.toContain("đã ôn xong");
  });

  it("chọn khoá chỉ hiện khi từ hai khoá, giữ đúng đường dẫn", () => {
    expect(render()).not.toContain("/language/lich-on-tap?course=");
    const two = render({ courses: [{ id: "c1", slug: "ielts", title: "IELTS Reading" }, { id: "c2", slug: "toeic", title: "TOEIC" }] });
    expect(two).toContain('href="/language/lich-on-tap?course=toeic"');
  });
});
