import { describe, expect, it } from "vitest";
import { nothingToReview, practiceWrongTotal, scheduleDayLabel, scheduleEnd, scheduleMax, scheduleTotal } from "./reviewScheduleView";

const DAY = 24 * 60 * 60 * 1000;
// 00:00 giờ VN ngày 03/10/2026 (thứ Bảy) = 2026-10-02T17:00:00Z.
const D0 = new Date("2026-10-02T17:00:00Z");

describe("scheduleDayLabel", () => {
  it("hôm nay, ngày mai, các ngày sau có thứ và ngày/tháng theo giờ Việt Nam", () => {
    expect(scheduleDayLabel(D0, 0)).toBe("Hôm nay");
    expect(scheduleDayLabel(new Date(D0.getTime() + DAY), 1)).toBe("Ngày mai");
    const l = scheduleDayLabel(new Date(D0.getTime() + 2 * DAY), 2);
    expect(l).toContain("05/10");
  });
  it("00:00 VN không bị lùi sang ngày hôm trước dù máy chủ ở múi giờ UTC", () => {
    expect(scheduleDayLabel(D0.toISOString(), 3)).toContain("03/10");
  });
});

describe("tổng hợp lịch", () => {
  const days = [{ dayStart: D0.toISOString(), count: 3 }, { dayStart: new Date(D0.getTime() + DAY).toISOString(), count: 0 }, { dayStart: new Date(D0.getTime() + 2 * DAY).toISOString(), count: 5 }];
  it("tổng, lớn nhất (tối thiểu 1) và ngày cuối", () => {
    expect(scheduleTotal(days)).toBe(8);
    expect(scheduleMax(days)).toBe(5);
    expect(scheduleMax([{ dayStart: D0.toISOString(), count: 0 }])).toBe(1);
    expect(scheduleMax([])).toBe(1);
    expect(scheduleEnd(days)!.getTime()).toBe(D0.getTime() + 3 * DAY - 1);
    expect(scheduleEnd([])).toBeNull();
  });
});

describe("câu luyện nên làm lại và trạng thái xong", () => {
  it("cộng số câu sai các đề", () => {
    expect(practiceWrongTotal([{ examId: "a", title: "A", wrong: 2 }, { examId: "b", title: "B", wrong: 3 }])).toBe(5);
    expect(practiceWrongTotal([])).toBe(0);
  });
  it("chỉ 'xong' khi cả ba khối đều trống", () => {
    expect(nothingToReview({ dueToday: 0, practiceWrong: 0, hasSuggestion: false })).toBe(true);
    for (const o of [{ dueToday: 1, practiceWrong: 0, hasSuggestion: false }, { dueToday: 0, practiceWrong: 1, hasSuggestion: false }, { dueToday: 0, practiceWrong: 0, hasSuggestion: true }]) {
      expect(nothingToReview(o)).toBe(false);
    }
  });
});
