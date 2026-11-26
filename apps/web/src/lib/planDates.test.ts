import { describe, expect, it } from "vitest";
import { dayToEndsAt, dayToStartsAt, endsAtToLastDay } from "./planDates";

describe("planDates", () => {
  it("'Từ ngày' là 00:00 giờ Việt Nam của ngày đó", () => {
    expect(dayToStartsAt("2026-11-26")).toBe("2026-11-25T17:00:00.000Z");
  });
  it("'Đến hết ngày' là 00:00 giờ Việt Nam của ngày KẾ TIẾP (loại trừ)", () => {
    expect(dayToEndsAt("2027-02-28")).toBe("2027-02-28T17:00:00.000Z");
    expect(dayToEndsAt("2026-12-31")).toBe("2026-12-31T17:00:00.000Z");
    expect(dayToEndsAt("2028-02-28")).toBe("2028-02-28T17:00:00.000Z");
  });
  it("hiển thị ngược: endsAt trừ một ngày", () => {
    expect(endsAtToLastDay("2027-02-28T17:00:00.000Z")).toBe("2027-02-28");
    expect(endsAtToLastDay(new Date("2026-12-31T17:00:00.000Z"))).toBe("2026-12-31");
  });
  it("khứ hồi", () => {
    expect(endsAtToLastDay(dayToEndsAt("2027-03-31")!)).toBe("2027-03-31");
  });
  it("ngày sai định dạng → null", () => {
    expect(dayToStartsAt("")).toBeNull();
    expect(dayToEndsAt("26/11/2026")).toBeNull();
  });
});
