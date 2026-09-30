import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AcademicTermLike } from "@feedbackme/shared-types";
import WorkspaceCalendar, { type CalendarAssignment } from "./WorkspaceCalendar";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const HK1: AcademicTermLike = { id: "hk1", name: "Học kỳ 1 2026-27", startDate: "2026-09-07", weekCount: 16 };

const HW: CalendarAssignment[] = [
  {
    id: "a1",
    title: "Bài tập tuần 4",
    courseTitle: "Thiết kế UI/UX",
    dueDay: "2026-09-30",
    dueTime: "23:59",
    state: "todo",
    href: "/learn/uiux/lessons/l1",
  },
  {
    id: "a2",
    title: "Báo cáo cũ",
    courseTitle: "Thiết kế UI/UX",
    dueDay: "2026-09-10",
    dueTime: "12:00",
    state: "overdue",
    href: "/learn/uiux/lessons/l2",
  },
  {
    id: "a3",
    title: "Nằm ngoài tháng",
    courseTitle: "Tiếng Trung III",
    dueDay: "2026-11-20",
    dueTime: "08:00",
    state: "graded",
    scoreLabel: "9/10",
    href: "/learn/tt3/lessons/l3",
  },
];

/** Chữ hiển thị (bỏ thẻ) — để kiểm nhãn mà không dính cấu trúc markup. */
const text = (out: string) => out.replace(/<[^>]+>/g, "");

const html = (props: Partial<React.ComponentProps<typeof WorkspaceCalendar>>) =>
  renderToStaticMarkup(
    <WorkspaceCalendar todayKey="2026-09-30" organizationName={null} terms={[]} defaultView="month" {...props} />,
  );

describe("WorkspaceCalendar — nhãn kỳ học", () => {
  it("tài khoản thuộc trường, đang trong kỳ: 'Tuần 4/16' + tên kỳ + tên trường + cột Tuần", () => {
    const out = html({ organizationName: "ĐH Kinh tế Quốc dân", terms: [HK1] });
    expect(text(out)).toContain("Tuần 4/16");
    expect(text(out)).toContain("Học kỳ 1 2026-27");
    expect(text(out)).toContain("ĐH Kinh tế Quốc dân");
    // cột "Tuần" của lưới: có số tuần của hàng 28/09 → 4
    expect(out).toMatch(/>Tuần<\/div>/);
  });

  it("tài khoản không thuộc trường: lịch trơn, không nhãn kỳ, không cột Tuần", () => {
    const out = html({ organizationName: null, terms: [HK1] });
    expect(text(out)).not.toContain("Tuần 4/16");
    expect(out).not.toContain("Học kỳ 1 2026-27");
    expect(out).not.toMatch(/>Tuần<\/div>/);
    // hiển thị tháng 9/2026 (ô chọn tháng/năm) + dòng "Hôm nay, thứ tư 30/09/2026"
    expect(out).toContain('value="9" selected=""');
    expect(out).toContain('value="2026" selected=""');
    expect(text(out)).toContain("Hôm nay, thứ tư 30/09/2026");
  });

  it("trường chưa khai báo kỳ: hiện tên trường + 'Ngoài kỳ học', không cột Tuần", () => {
    const out = html({ organizationName: "Trường A", terms: [] });
    expect(out).toContain("Ngoài kỳ học");
    expect(out).toContain("Trường A");
    expect(out).not.toMatch(/>Tuần<\/div>/);
  });

  it("chưa vào kỳ: báo kỳ sắp bắt đầu sau bao nhiêu ngày", () => {
    const out = html({ todayKey: "2026-09-01", organizationName: "Trường A", terms: [HK1] });
    expect(out).toContain("bắt đầu sau 6 ngày");
  });
});

describe("WorkspaceCalendar — hạn nộp bài tập", () => {
  it("chấm ở mọi ngày có hạn nộp; danh sách bên dưới là của NGÀY ĐANG CHỌN (mặc định hôm nay)", () => {
    const out = html({ organizationName: "Trường A", terms: [HK1], assignments: HW });
    // dấu trên lưới
    expect(out).toContain('aria-label="30/09, 1 việc đến hạn, hôm nay"');
    expect(out).toContain('aria-label="10/09, 1 việc đến hạn"');
    // hôm nay được chọn sẵn, hôm nay là ngày 30
    expect(out).toContain("Ngày 30 tháng 09");
    expect(out).toContain("Bài tập tuần 4");
    expect(out).toContain("23:59");
    expect(out).toContain("Chưa nộp");
    expect(out).toContain('href="/learn/uiux/lessons/l1"');
    // bài của ngày khác không lẫn vào danh sách
    expect(out).not.toContain("Báo cáo cũ");
    expect(out).not.toContain("Nằm ngoài tháng");
  });

  it("không truyền assignments: không có danh sách theo ngày", () => {
    const out = html({ organizationName: "Trường A", terms: [HK1] });
    expect(out).not.toContain("Không có hạn nộp");
    expect(out).not.toContain("Ngày 30 tháng 09");
  });

  it("ngày không có hạn nộp: báo trống và gợi ý hạn nộp kế tiếp", () => {
    const out = html({ todayKey: "2026-09-29", assignments: HW });
    expect(out).toContain("Không có hạn nộp ngày này.");
    expect(out).toContain("Hạn nộp tiếp theo: Thứ Tư 30/9");
  });

  it("ngày trống và không còn hạn nào phía sau: chỉ báo trống, không gợi ý", () => {
    const out = html({ todayKey: "2027-03-15", assignments: HW });
    expect(out).toContain("Không có hạn nộp ngày này.");
    expect(out).not.toContain("Hạn nộp tiếp theo");
  });
});

describe("WorkspaceCalendar — tiêu đề & khung", () => {
  it("có ô chọn tháng/năm và nút Tuần/Tháng, chấm dưới ngày, số tuần hiện ở danh sách", () => {
    const out = html({ organizationName: "Trường A", terms: [HK1], assignments: HW });
    expect(out).toContain('aria-label="Tháng"');
    expect(out).toContain('aria-label="Năm"');
    expect(out).toContain("Chế độ xem");
    expect(out).toContain("Hôm nay</span>"); // chip trong tiêu đề danh sách
  });
});

describe("WorkspaceCalendar — giáo viên", () => {
  const TEACHER: CalendarAssignment[] = [
    {
      id: "t1",
      title: "Bài nộp cuối kỳ",
      courseTitle: "Thiết kế UI/UX",
      dueDay: "2026-09-30",
      dueTime: "23:59",
      state: "upcoming",
      detail: "12 bài nộp · 3 chờ chấm",
      href: "/instructor/assignments/t1/submissions",
    },
    {
      id: "t2",
      title: "Bài đã hết hạn",
      courseTitle: "Tiếng Trung III",
      dueDay: "2026-09-10",
      dueTime: "12:00",
      state: "closed",
      detail: "chưa có bài nộp",
      href: "/instructor/assignments/t2/submissions",
    },
  ];

  it("hiện hạn nộp các khoá mình dạy kèm số bài nộp/chờ chấm, link sang trang chấm", () => {
    const out = html({ organizationName: "Trường A", terms: [HK1], assignments: TEACHER });
    expect(out).toContain("Sắp đến hạn");
    expect(out).toContain("12 bài nộp · 3 chờ chấm");
    expect(out).toContain('href="/instructor/assignments/t1/submissions"');
    // bài hết hạn của ngày khác vẫn được đánh dấu trên lưới
    expect(out).toContain('aria-label="10/09, 1 việc đến hạn"');
    // không dùng từ của học viên
    expect(out).not.toContain("Chưa nộp");
    expect(out).not.toContain("Quá hạn");
  });
});

describe("WorkspaceCalendar — gọn (mặc định xem tuần)", () => {
  it("mặc định chỉ 1 hàng tuần: có khoảng ngày + chip số tuần, không có ô chọn tháng/năm", () => {
    const out = html({ defaultView: "week", organizationName: "Trường A", terms: [HK1], assignments: HW });
    expect(text(out)).toContain("28/9 – 4/10/2026");
    expect(text(out)).toContain("Tuần 4");
    expect(out).not.toContain('aria-label="Năm"');
    // chỉ 7 ngày của tuần 28/9–4/10 → không có ô ngày 10/09
    expect(out).toContain('aria-label="30/09, 1 việc đến hạn, hôm nay"');
    expect(out).not.toContain('aria-label="10/09');
  });

  it("không truyền defaultView thì là tuần", () => {
    const out = renderToStaticMarkup(
      <WorkspaceCalendar todayKey="2026-09-30" organizationName={null} terms={[]} />,
    );
    expect(out).not.toContain('aria-label="Năm"');
  });
});

describe("WorkspaceCalendar — tiêu đề theo tuần đang xem", () => {
  it("xem tuần 26/10–1/11 (tuần 8): tiêu đề, cột tuần và chip đều là tuần 8, không còn 'Tuần 4/15'", () => {
    const out = html({
      defaultView: "week",
      initialDay: "2026-10-28",
      organizationName: "Trường A",
      terms: [HK1],
    });
    expect(text(out)).toContain("Tuần 8/16");
    expect(text(out)).not.toContain("Tuần 4/16");
    expect(text(out)).toContain("26/10 – 1/11/2026");
  });

  it("xem tuần ngoài kỳ: tiêu đề báo ngoài kỳ thay vì giữ số tuần cũ", () => {
    const out = html({
      defaultView: "week",
      initialDay: "2027-01-05",
      organizationName: "Trường A",
      terms: [HK1],
    });
    expect(text(out)).toContain("Ngoài kỳ học");
    expect(text(out)).not.toContain("Tuần 4/16");
  });

  it("xem tuần trước khi kỳ bắt đầu: nêu ngày bắt đầu của kỳ (không phải 'sau N ngày' tính từ hôm nay)", () => {
    const out = html({
      defaultView: "week",
      initialDay: "2026-08-24",
      organizationName: "Trường A",
      terms: [HK1],
    });
    expect(text(out)).toContain("Chưa vào kỳ");
    expect(text(out)).toContain("bắt đầu 07/09/2026");
  });
});

describe("WorkspaceCalendar — quiz của học viên", () => {
  const QUIZ: CalendarAssignment[] = [
    {
      id: "quiz:q1",
      title: "Quiz giữa kỳ",
      courseTitle: "Thiết kế UI/UX",
      dueDay: "2026-09-30",
      dueTime: "20:00",
      state: "todo",
      kind: "quiz",
      stateLabel: "Chưa làm",
      href: "/learn/uiux/quizzes/q1",
    },
    {
      id: "quiz:q2",
      title: "Quiz đã xong",
      courseTitle: "Thiết kế UI/UX",
      dueDay: "2026-09-30",
      dueTime: "21:00",
      state: "graded",
      kind: "quiz",
      scoreLabel: "85%",
      stateLabel: "Đã làm",
      href: "/learn/uiux/quizzes/q2",
    },
  ];

  it("quiz hiện cùng bài tập: nhãn 'Quiz', trạng thái riêng, link vào trang làm quiz", () => {
    const out = html({ organizationName: "Trường A", terms: [HK1], assignments: [...HW, ...QUIZ] });
    expect(text(out)).toContain("Quiz · Thiết kế UI/UX");
    expect(text(out)).toContain("Chưa làm");
    expect(text(out)).toContain("✓ 85%");
    expect(out).toContain('href="/learn/uiux/quizzes/q1"');
    // bài tập cùng ngày vẫn còn; ô ngày báo tổng số việc (2 quiz + 1 bài tập = 3)
    expect(text(out)).toContain("Bài tập tuần 4");
    expect(out).toContain('aria-label="30/09, 3 việc đến hạn, hôm nay"');
  });
});

describe("WorkspaceCalendar — nút điều hướng", () => {
  it("nút Trước/Sau có chữ và nhãn rõ theo chế độ (tuần/tháng)", () => {
    const week = html({ defaultView: "week" });
    expect(week).toContain('aria-label="Tuần trước"');
    expect(week).toContain('aria-label="Tuần sau"');
    expect(text(week)).toContain("Trước");
    expect(text(week)).toContain("Sau");
    const month = html({ defaultView: "month" });
    expect(month).toContain('aria-label="Tháng trước"');
    expect(month).toContain('aria-label="Tháng sau"');
  });

  it("'Về hôm nay' chỉ hiện khi đang xem ngày khác hôm nay", () => {
    expect(text(html({ defaultView: "week" }))).not.toContain("Về hôm nay");
    expect(text(html({ defaultView: "week", initialDay: "2026-10-12" }))).toContain("Về hôm nay");
  });
});

