import { describe, expect, it } from "vitest";
import { isDayKey, resolveWeek, todayVN, weekStart } from "./weekRange";

describe("weekRange — tuần theo giờ Việt Nam", () => {
  it("thứ hai của tuần chứa một ngày (chủ nhật thuộc tuần trước chứ không phải tuần sau)", () => {
    expect(weekStart("2026-11-03")).toBe("2026-11-02"); // thứ ba
    expect(weekStart("2026-11-02")).toBe("2026-11-02"); // thứ hai
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // chủ nhật
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
  });

  it("tuần có đủ từ, đến, tuần trước, tuần sau; qua năm vẫn đúng", () => {
    expect(resolveWeek("2026-11-05")).toEqual({ from: "2026-11-02", to: "2026-11-08", prev: "2026-10-26", next: "2026-11-09" });
    expect(resolveWeek("2026-12-31")).toEqual({ from: "2026-12-28", to: "2027-01-03", prev: "2026-12-21", next: "2027-01-04" });
  });

  it("hôm nay tính theo giờ Việt Nam: 17:30 UTC đã là sáng hôm sau", () => {
    expect(todayVN(new Date("2026-11-03T16:59:00.000Z"))).toBe("2026-11-03");
    expect(todayVN(new Date("2026-11-03T17:00:00.000Z"))).toBe("2026-11-04");
    expect(resolveWeek(undefined, new Date("2026-11-08T17:30:00.000Z")).from).toBe("2026-11-09"); // đã sang thứ hai ở VN
  });

  it("đầu vào sai hoặc rỗng rơi về tuần hiện tại, không lỗi", () => {
    const now = new Date("2026-11-04T03:00:00.000Z");
    for (const bad of ["", "abc", "2026-13-40", "2026-02-30", undefined, ["2026-11-01"] as unknown as string]) {
      expect(resolveWeek(bad, now).from).toBe("2026-11-02");
    }
    expect(isDayKey("2026-02-28")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
  });
});
