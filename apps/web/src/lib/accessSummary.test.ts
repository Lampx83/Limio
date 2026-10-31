import { describe, expect, it } from "vitest";
import { accessSummary } from "./accessSummary";

describe("accessSummary", () => {
  it("không có hạn → vĩnh viễn", () => {
    expect(accessSummary(null)).toBe("Truy cập vĩnh viễn.");
    expect(accessSummary(undefined)).toBe("Truy cập vĩnh viễn.");
    expect(accessSummary("")).toBe("Truy cập vĩnh viễn.");
  });

  it("có hạn → ngày theo giờ Việt Nam, không lệch ngày quanh nửa đêm UTC", () => {
    // 20:00 UTC ngày 4/11 = 03:00 ngày 5/11 ở Việt Nam.
    expect(accessSummary("2026-11-04T20:00:00.000Z")).toMatch(/^Truy cập đến .*05.*11.*2026.*\.$/);
  });
});
