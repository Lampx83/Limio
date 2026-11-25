import { describe, expect, it } from "vitest";
import { accessExpiryInfo } from "./accessExpiry";

const now = new Date("2026-11-25T03:00:00Z");
describe("accessExpiryInfo", () => {
  it("không hạn → không giới hạn", () => {
    expect(accessExpiryInfo(null, now)).toEqual({ kind: "lifetime" });
    expect(accessExpiryInfo(undefined, now)).toEqual({ kind: "lifetime" });
  });
  it("còn lâu → ngày hết hạn, không cảnh báo", () => {
    const r = accessExpiryInfo("2027-11-25T03:00:00Z", now);
    expect(r).toMatchObject({ kind: "until", daysLeft: 365, soon: false });
    expect(r.kind === "until" && r.dateText).toBe("25/11/2027");
  });
  it("còn 30 ngày trở xuống → sắp hết hạn; làm tròn lên", () => {
    expect(accessExpiryInfo("2026-12-25T03:00:00Z", now)).toMatchObject({ daysLeft: 30, soon: true });
    expect(accessExpiryInfo("2026-12-26T03:00:00Z", now)).toMatchObject({ daysLeft: 31, soon: false });
    expect(accessExpiryInfo("2026-11-25T03:10:00Z", now)).toMatchObject({ daysLeft: 1, soon: true });
  });
  it("hạn đã qua → 0 ngày", () => {
    expect(accessExpiryInfo("2026-11-20T00:00:00Z", now)).toMatchObject({ daysLeft: 0, soon: true });
  });
});
