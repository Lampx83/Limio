import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  isDayKey,
  mondayOfKey,
  resolveAcademicPosition,
  termFirstDay,
  termLastDay,
  termsOverlap,
  weekLabelForDay,
  weekOfTerm,
  type AcademicTermLike,
} from "@feedbackme/shared-types";

// 2026-09-07 là thứ Hai.
const HK1: AcademicTermLike = { id: "hk1", name: "HK1 2026-27", startDate: "2026-09-07", weekCount: 16 };
const HK2: AcademicTermLike = { id: "hk2", name: "HK2 2026-27", startDate: "2027-01-25", weekCount: 15 };

describe("day-key helpers", () => {
  it("isDayKey từ chối định dạng sai và ngày không có thật", () => {
    expect(isDayKey("2026-09-07")).toBe(true);
    expect(isDayKey("2026-02-31")).toBe(false);
    expect(isDayKey("2026-9-7")).toBe(false);
    expect(isDayKey(20260907)).toBe(false);
  });

  it("cộng ngày qua tháng/năm, kể cả năm nhuận", () => {
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToKey("2026-09-07", -7)).toBe("2026-08-31");
  });

  it("mondayOfKey: Chủ Nhật thuộc tuần trước, không nhảy sang tuần sau", () => {
    expect(mondayOfKey("2026-09-07")).toBe("2026-09-07"); // T2
    expect(mondayOfKey("2026-09-13")).toBe("2026-09-07"); // CN
    expect(mondayOfKey("2026-09-14")).toBe("2026-09-14"); // T2 kế
  });
});

describe("weekOfTerm", () => {
  it("tuần 1 bắt đầu đúng ngày khai báo và tuần cuối kết thúc Chủ Nhật", () => {
    expect(weekOfTerm("2026-09-07", HK1)).toBe(1);
    expect(weekOfTerm("2026-09-13", HK1)).toBe(1);
    expect(weekOfTerm("2026-09-14", HK1)).toBe(2);
    expect(termLastDay(HK1)).toBe("2026-12-27");
    expect(weekOfTerm("2026-12-27", HK1)).toBe(16);
  });

  it("ngoài kỳ → null (trước tuần 1 và sau tuần cuối)", () => {
    expect(weekOfTerm("2026-09-06", HK1)).toBeNull();
    expect(weekOfTerm("2026-12-28", HK1)).toBeNull();
  });

  it("kỳ bắt đầu giữa tuần: tuần 1 là tuần lịch chứa ngày đó", () => {
    const midweek: AcademicTermLike = { id: "m", name: "m", startDate: "2026-09-09", weekCount: 2 }; // T4
    expect(termFirstDay(midweek)).toBe("2026-09-07");
    expect(weekOfTerm("2026-09-07", midweek)).toBe(1);
    expect(weekOfTerm("2026-09-14", midweek)).toBe(2);
    expect(weekOfTerm("2026-09-21", midweek)).toBeNull();
  });
});

describe("resolveAcademicPosition", () => {
  const terms = [HK2, HK1]; // cố ý không theo thứ tự

  it("trong kỳ → tuần hiện tại / tổng số tuần", () => {
    const p = resolveAcademicPosition("2026-09-30", terms); // T4 tuần 4
    expect(p).toMatchObject({ kind: "in_term", week: 4, weekCount: 16 });
    if (p.kind === "in_term") expect(p.term.id).toBe("hk1");
  });

  it("nghỉ giữa hai kỳ → kỳ sắp tới và số ngày còn lại", () => {
    const p = resolveAcademicPosition("2027-01-20", terms);
    expect(p).toMatchObject({ kind: "before_term", daysUntilStart: 5 });
    if (p.kind === "before_term") expect(p.term.id).toBe("hk2");
  });

  it("sau kỳ cuối, hoặc trường chưa khai báo kỳ nào → no_term", () => {
    expect(resolveAcademicPosition("2027-06-01", terms)).toEqual({ kind: "no_term" });
    expect(resolveAcademicPosition("2026-09-30", [])).toEqual({ kind: "no_term" });
  });
});

describe("termsOverlap", () => {
  it("kỳ liền kề (không chung tuần) không chồng nhau", () => {
    const next: AcademicTermLike = { id: "n", name: "n", startDate: "2026-12-28", weekCount: 4 };
    expect(termsOverlap(HK1, next)).toBe(false);
  });

  it("chung dù một tuần lịch là chồng — kể cả khi ngày khai báo khác nhau", () => {
    const wed: AcademicTermLike = { id: "w", name: "w", startDate: "2026-12-23", weekCount: 4 }; // T4 của tuần cuối HK1
    expect(termsOverlap(HK1, wed)).toBe(true);
    expect(termsOverlap(wed, HK1)).toBe(true);
  });
});

describe("weekLabelForDay", () => {
  it("cho cột Tuần của lịch tháng: có số tuần trong kỳ, ngoài kỳ thì null", () => {
    expect(weekLabelForDay("2026-10-05", [HK1])?.week).toBe(5);
    expect(weekLabelForDay("2026-08-31", [HK1])).toBeNull();
  });
});
