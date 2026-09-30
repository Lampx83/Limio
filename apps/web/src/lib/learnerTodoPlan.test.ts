import { describe, expect, it } from "vitest";
import { buildTodoPlan, describeDue, isAutoHidden, paginate, type TodoItem } from "./learnerTodoPlan";

const TODAY = "2026-09-30";

let n = 0;
function item(p: Partial<TodoItem> & { dueDay: string | null }): TodoItem {
  n++;
  return {
    id: p.id ?? `i${n}`,
    kind: "assignment",
    title: p.title ?? `Việc ${n}`,
    courseTitle: p.courseTitle ?? "Khoá A",
    href: "/x",
    dueDay: p.dueDay,
    dueTime: p.dueDay ? (p.dueTime ?? "23:59") : null,
    overdue: p.overdue ?? false,
    inProgress: p.inProgress,
  };
}

describe("buildTodoPlan — xếp hạng", () => {
  it("hạn gần nhất lên đầu; việc quá hạn nằm trước việc còn hạn; cùng ngày xếp theo giờ", () => {
    const items = [
      item({ id: "later", dueDay: "2026-10-09" }),
      item({ id: "today-late", dueDay: "2026-09-30", dueTime: "23:59" }),
      item({ id: "over", dueDay: "2026-09-27", overdue: true }),
      item({ id: "today-early", dueDay: "2026-09-30", dueTime: "17:00" }),
    ];
    const { top } = buildTodoPlan(items, TODAY);
    expect(top.map((i) => i.id)).toEqual(["over", "today-early", "today-late", "later"]);
  });

  it("top chỉ lấy 5; việc không hạn KHÔNG chen vào top mà ra khu riêng", () => {
    const items = [
      ...Array.from({ length: 7 }, (_, i) => item({ dueDay: `2026-10-0${i + 1}` })),
      item({ id: "nd1", dueDay: null }),
    ];
    const plan = buildTodoPlan(items, TODAY);
    expect(plan.top).toHaveLength(5);
    expect(plan.top.every((i) => i.dueDay !== null)).toBe(true);
    expect(plan.noDue.map((i) => i.id)).toEqual(["nd1"]);
    // danh sách đầy đủ: có hạn (7) rồi không hạn (1)
    expect(plan.all).toHaveLength(8);
    expect(plan.all[7]!.id).toBe("nd1");
  });
});

describe("buildTodoPlan — thống kê", () => {
  it("đếm quá hạn / sắp hết hạn (≤3 ngày) / còn hạn / không hạn / tổng", () => {
    const items = [
      item({ dueDay: "2026-09-25", overdue: true }),
      item({ dueDay: "2026-09-29", overdue: true }),
      item({ dueDay: "2026-09-30" }), // hôm nay: sắp
      item({ dueDay: "2026-10-03" }), // đúng 3 ngày: sắp
      item({ dueDay: "2026-10-04" }), // 4 ngày: còn hạn
      item({ dueDay: null }),
    ];
    expect(buildTodoPlan(items, TODAY).stats).toEqual({
      total: 6,
      overdue: 2,
      urgent: 2,
      later: 1,
      noDue: 1,
      autoHidden: 0,
    });
  });
});

describe("tự ẩn khi quá hạn hơn 1 tuần", () => {
  // TODAY = 2026-09-30 → quá đúng 7 ngày là 2026-09-23 (còn hiện), 8 ngày là 2026-09-22 (tự ẩn)
  const seven = item({ id: "d7", dueDay: "2026-09-23", overdue: true });
  const eight = item({ id: "d8", dueDay: "2026-09-22", overdue: true });
  const upcoming = item({ id: "up", dueDay: "2026-10-02" });

  it("mốc: quá 7 ngày vẫn hiện, quá 8 ngày trở đi tự rời khỏi top (không cần thao tác gì)", () => {
    expect(isAutoHidden(seven, TODAY)).toBe(false);
    expect(isAutoHidden(eight, TODAY)).toBe(true);
    const plan = buildTodoPlan([eight, seven, upcoming], TODAY);
    expect(plan.top.map((i) => i.id)).toEqual(["d7", "up"]);
  });

  it("vẫn còn trong danh sách đầy đủ và trong số liệu 'quá hạn'; đếm riêng là autoHidden", () => {
    const plan = buildTodoPlan([eight, seven, upcoming], TODAY);
    expect(plan.all.map((i) => i.id)).toEqual(["d8", "d7", "up"]);
    expect(plan.stats).toMatchObject({ overdue: 2, autoHidden: 1, total: 3 });
  });

  it("chỉ áp dụng cho việc quá hạn: việc còn hạn hay không hạn không bị tự ẩn", () => {
    expect(isAutoHidden(upcoming, TODAY)).toBe(false);
    expect(isAutoHidden(item({ dueDay: null }), TODAY)).toBe(false);
  });

  it("ẩn tự động giải phóng chỗ trong top 5 cho việc kế tiếp", () => {
    const many = [eight, ...Array.from({ length: 5 }, (_, i) => item({ id: `u${i}`, dueDay: `2026-10-0${i + 1}` }))];
    expect(buildTodoPlan(many, TODAY).top.map((i) => i.id)).toEqual(["u0", "u1", "u2", "u3", "u4"]);
  });
});

describe("describeDue", () => {
  it("diễn đạt theo số ngày còn lại/đã quá", () => {
    expect(describeDue(item({ dueDay: "2026-09-27", dueTime: "12:00", overdue: true }), TODAY)).toBe("Quá hạn 3 ngày");
    expect(describeDue(item({ dueDay: "2026-09-30", dueTime: "08:00", overdue: true }), TODAY)).toBe("Quá hạn hôm nay 08:00");
    expect(describeDue(item({ dueDay: "2026-09-30", dueTime: "20:00" }), TODAY)).toBe("Hôm nay 20:00");
    expect(describeDue(item({ dueDay: "2026-10-01", dueTime: "12:00" }), TODAY)).toBe("Ngày mai 12:00");
    expect(describeDue(item({ dueDay: "2026-10-05" }), TODAY)).toBe("Còn 5 ngày · 05/10");
    expect(describeDue(item({ dueDay: null }), TODAY)).toBe("Không có hạn");
  });
});

describe("paginate", () => {
  const list = Array.from({ length: 19 }, (_, i) => i);
  it("chia trang và kẹp số trang ngoài khoảng", () => {
    expect(paginate(list, 1, 8)).toMatchObject({ page: 1, pages: 3, rows: list.slice(0, 8) });
    expect(paginate(list, 3, 8).rows).toEqual([16, 17, 18]);
    expect(paginate(list, 99, 8).page).toBe(3);
    expect(paginate(list, 0, 8).page).toBe(1);
    expect(paginate([], 1, 8)).toEqual({ rows: [], page: 1, pages: 1 });
  });
});
