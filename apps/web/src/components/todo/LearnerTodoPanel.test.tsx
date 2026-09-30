import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LearnerTodoPanel from "./LearnerTodoPanel";
import type { TodoItem } from "@/lib/learnerTodoPlan";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const TODAY = "2026-09-30";

function it_(id: string, p: Partial<TodoItem>): TodoItem {
  return {
    id,
    kind: "assignment",
    title: `Việc ${id}`,
    courseTitle: "Khoá demo",
    href: `/learn/demo/lessons/${id}`,
    dueDay: "2026-10-05",
    dueTime: "23:59",
    overdue: false,
    ...p,
  };
}

const text = (out: string) => out.replace(/<[^>]+>/g, "");
const render = (items: TodoItem[]) =>
  renderToStaticMarkup(<LearnerTodoPanel todayKey={TODAY} items={items} />);

describe("LearnerTodoPanel", () => {
  it("không còn việc nào: lời chúc mừng, không có thống kê", () => {
    const out = render([]);
    expect(text(out)).toContain("Bạn đã hoàn thành hết bài tập và quiz");
    expect(out).not.toContain("<dl");
  });

  it("thống kê + top việc có hạn (gần hạn trước) + khu 'Không có thời hạn' + nút xem tất cả", () => {
    const items = [
      it_("late", { dueDay: "2026-10-20", title: "Xa nhất" }),
      it_("over", { dueDay: "2026-09-27", overdue: true, title: "Quá hạn rồi", kind: "quiz" }),
      it_("today", { dueDay: "2026-09-30", dueTime: "20:00", title: "Hôm nay nộp" }),
      it_("s3", { dueDay: "2026-10-01" }),
      it_("s4", { dueDay: "2026-10-02" }),
      it_("s5", { dueDay: "2026-10-03" }),
      it_("nd1", { dueDay: null, dueTime: null, title: "Đọc thêm" }),
      it_("nd2", { dueDay: null, dueTime: null }),
      it_("nd3", { dueDay: null, dueTime: null }),
      it_("nd4", { dueDay: null, dueTime: null }),
    ];
    const t = text(render(items));
    expect(t).toContain("10 chưa nộp");
    // 1 quá hạn; ≤3 ngày: today,s3,s4,s5 = 4; còn hạn: late = 1; không hạn: 4
    expect(t).toMatch(/1Quá hạn/);
    expect(t).toMatch(/4≤ 3 ngày/);
    expect(t).toMatch(/1Còn hạn/);
    expect(t).toMatch(/4Không hạn/);
    // top 5 theo hạn: quá hạn → hôm nay → 3 việc kế; việc xa nhất (thứ 7) không lọt top
    expect(t).toContain("Quá hạn rồi");
    expect(t).toContain("Quá hạn 3 ngày");
    expect(t).toContain("Hôm nay 20:00");
    expect(t).not.toContain("Xa nhất");
    // khu không hạn: xem trước 3 việc, còn 1
    expect(t).toContain("Không có thời hạn · 4");
    expect(t).toContain("+1 việc nữa");
    expect(t).toContain("Xem tất cả (10)");
  });

  it("không có nút ẩn thủ công nào", () => {
    const out = render([
      it_("over", { dueDay: "2026-09-26", overdue: true, title: "Quá hạn" }),
      it_("ok", { title: "Còn hạn" }),
    ]);
    expect(out).not.toContain("Ẩn “");
    expect(out).not.toContain("Hiện lại");
  });

  it("quiz hiện nhãn Quiz, quiz đang làm dở có 'Đang làm', link đúng", () => {
    const out = render([
      it_("q", { kind: "quiz", title: "Quiz giữa kỳ", inProgress: true, href: "/learn/demo/quizzes/q" }),
    ]);
    expect(text(out)).toContain("Quiz Khoá demo");
    expect(text(out)).toContain("Đang làm");
    expect(out).toContain('title="Khoá demo"');
    expect(out).toContain('href="/learn/demo/quizzes/q"');
  });

  it("việc quá hạn hơn 1 tuần tự rời khỏi top (không cần ẩn), có ghi chú tự ẩn và vẫn tính vào 'Quá hạn'", () => {
    const out = render([
      it_("old", { dueDay: "2026-09-15", overdue: true, title: "Bài quá cũ" }), // 15 ngày
      it_("edge", { dueDay: "2026-09-23", overdue: true, title: "Vừa đủ 7 ngày" }), // đúng 7 ngày: còn hiện
      it_("ok", { dueDay: "2026-10-02", title: "Còn hạn" }),
    ]);
    const t = text(out);
    expect(t).not.toContain("Bài quá cũ"); // rời top, chưa mở rộng nên không thấy
    expect(t).toContain("Vừa đủ 7 ngày");
    expect(t).toMatch(/2Quá hạn/); // cả 2 vẫn đếm là quá hạn
    expect(t).toContain("1 việc quá hạn trên 1 tuần đã tự ẩn khỏi danh sách ưu tiên");
    expect(t).toContain("Xem tất cả (3)"); // còn cách xem lại
  });
});

