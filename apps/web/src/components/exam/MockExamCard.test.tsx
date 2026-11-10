import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MockExamCard as Data } from "@feedbackme/core-lms";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import MockExamCard from "./MockExamCard";
import { ExamRefLearnerBlock, ExamRefPreviewBlock } from "./ExamRefBlock";

// docs/tieu-chi/bai-hoc-gan-de-thi.md — thẻ đề dùng chung ở trang khoá và ở khối "Đề thi" trong bài.

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const card = (o: Partial<Data> = {}): Data => ({
  examId: "e1",
  title: "Thi thử HSK 3",
  totalMinutes: 9,
  allowMock: true,
  allowPractice: true,
  sections: [
    { title: "Nghe", languageSkill: "listening", durationMin: 3 },
    { title: "Đọc", languageSkill: "reading", durationMin: 4 },
  ],
  attempt: null,
  attemptCount: 0,
  practice: { inProgress: null, completedCount: 0 },
  ...o,
});

describe("MockExamCard", () => {
  it("hai cột Thi thử / Luyện đề với mô tả, trạng thái, nút và đích đúng", () => {
    const html = renderToStaticMarkup(<MockExamCard slug="hsk" exam={card()} />);
    const t = text(html);
    expect(t).toContain("Thi thử HSK 3");
    expect(t).toContain("2 phần · 9 phút");
    expect(t).toContain("Mô phỏng thi thật");
    expect(t).toContain("Chưa làm");
    expect(t).toContain("Không bấm giờ, xem đáp án ngay");
    expect(t).toContain("Chưa luyện");
    expect(html).toContain('href="/learn/hsk/exams/e1"');
    expect(html).toContain('href="/learn/hsk/exams/e1/practice"');
    expect(html).toContain("sm:grid-cols-2");
  });

  it("đang làm dở và đang luyện dở: Tiếp tục thi và Tiếp tục luyện, luyện đề vào thẳng buổi dở", () => {
    const html = renderToStaticMarkup(
      <MockExamCard
        slug="hsk"
        exam={card({ attempt: { attemptId: "a1", status: "in_progress", submittedAt: null, scorePct: null }, attemptCount: 1, practice: { inProgress: { sessionId: "s1", answered: 3, total: 10 }, completedCount: 0 } })}
      />,
    );
    const t = text(html);
    expect(t).toContain("Tiếp tục thi");
    expect(t).toContain("Đang luyện dở · 3/10 câu");
    expect(t).toContain("Tiếp tục luyện");
    expect(html).toContain('href="/learn/hsk/exams/e1/practice/s1"');
  });

  it("đề chỉ bật một chế độ thì một cột; tiêu đề khối (nếu có) thay tên đề", () => {
    const html = renderToStaticMarkup(<MockExamCard slug="hsk" exam={card({ allowPractice: false })} titleOverride="Thi cuối unit 3" />);
    const t = text(html);
    expect(t).toContain("Thi cuối unit 3");
    expect(t).not.toContain("Thi thử HSK 3");
    expect(t).not.toContain("Luyện đề");
    expect(html).not.toContain("sm:grid-cols-2");
  });
});

describe("ExamRefBlock", () => {
  it("học viên: thẻ đề trong khung, tiêu đề khối thắng tên đề", () => {
    const html = renderToStaticMarkup(<ExamRefLearnerBlock slug="hsk" exam={card()} title="Thi cuối unit" />);
    expect(text(html)).toContain("Thi cuối unit");
    expect(html).toContain('data-testid="mock-exam-card"');
  });

  it("giảng viên xem thử: thẻ không bấm được kèm ghi chú; đề không dùng được thì nhãn lý do, không có thẻ", () => {
    const ok = renderToStaticMarkup(<ExamRefPreviewBlock slug="hsk" exam={card()} issue="ok" />);
    expect(text(ok)).toContain("Xem trước: học viên bấm được");
    expect(ok).toContain("pointer-events-none");
    for (const [issue, phrase] of [
      ["draft", "Đề chưa xuất bản"],
      ["archived", "Đề đã lưu trữ"],
      ["missing", "Đề đã bị xoá"],
      ["not_selected", "Chưa chọn đề"],
      ["modes_off", "tắt cả Thi thử và Luyện đề"],
      ["other_course", "khoá khác"],
    ] as const) {
      const h = renderToStaticMarkup(<ExamRefPreviewBlock slug="hsk" exam={null} issue={issue} />);
      expect(text(h), issue).toContain(phrase);
      expect(h, issue).not.toContain('data-testid="mock-exam-card"');
    }
  });
});
