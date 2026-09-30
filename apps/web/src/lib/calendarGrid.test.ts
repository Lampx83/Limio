import { describe, expect, it } from "vitest";
import { addMonthsToKey, monthGrid, weekDays } from "./calendarGrid";

describe("calendarGrid", () => {
  it("weekDays: 7 ngày T2→CN, Chủ Nhật vẫn thuộc tuần của T2 trước nó", () => {
    expect(weekDays("2026-09-13")).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13",
    ]);
  });

  it("monthGrid tháng 9/2026: bắt đầu thứ Ba nên hàng đầu lùi về 31/08, 5 hàng", () => {
    const g = monthGrid("2026-09-15");
    expect(g).toHaveLength(5);
    expect(g[0]![0]).toBe("2026-08-31");
    expect(g[4]![6]).toBe("2026-10-04");
    expect(g.every((r) => r.length === 7)).toBe(true);
  });

  it("monthGrid: 4, 5 và 6 hàng tuỳ tháng bắt đầu thứ mấy", () => {
    expect(monthGrid("2027-02-10")).toHaveLength(4); // 1/2/2027 là T2, đủ 28 ngày
    expect(monthGrid("2026-10-01")).toHaveLength(5);
    expect(monthGrid("2026-11-01")).toHaveLength(6); // 1/11/2026 là CN → hàng đầu 26/10, hàng cuối 30/11
    expect(monthGrid("2027-05-01")).toHaveLength(6); // 1/5/2027 là T7, 31 ngày
  });

  it("addMonthsToKey qua năm và về mùng 1", () => {
    expect(addMonthsToKey("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonthsToKey("2027-01-31", -1)).toBe("2026-12-01");
    expect(addMonthsToKey("2026-03-31", -1)).toBe("2026-02-01");
    expect(addMonthsToKey("2026-01-05", -13)).toBe("2024-12-01");
  });
});
