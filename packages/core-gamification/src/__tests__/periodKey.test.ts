import { describe, expect, it } from "vitest";
import { periodKeyOf, periodRange } from "../leaderboard/periodKey";

describe("periodKeyOf (VN+07)", () => {
  it("daily key uses VN-local date, not UTC date", () => {
    expect(periodKeyOf("daily", new Date("2026-05-13T16:59:59Z"))).toBe("2026-05-13");
    expect(periodKeyOf("daily", new Date("2026-05-13T17:00:00Z"))).toBe("2026-05-14");
  });

  it("monthly key rolls over at VN midnight, not UTC midnight", () => {
    expect(periodKeyOf("monthly", new Date("2026-05-31T16:30:00Z"))).toBe("2026-05");
    expect(periodKeyOf("monthly", new Date("2026-05-31T17:30:00Z"))).toBe("2026-06");
  });

  it("weekly key uses ISO week of VN-local date", () => {
    expect(periodKeyOf("weekly", new Date("2026-05-13T12:00:00Z"))).toBe("2026-W20");
    expect(periodKeyOf("weekly", new Date("2026-05-11T03:00:00Z"))).toBe("2026-W20");
    expect(periodKeyOf("weekly", new Date("2026-05-17T03:00:00Z"))).toBe("2026-W20");
    expect(periodKeyOf("weekly", new Date("2026-05-17T17:00:00Z"))).toBe("2026-W21");
  });

  it("year boundary on weekly: 2026-01-01 (Thu) belongs to 2026-W01", () => {
    expect(periodKeyOf("weekly", new Date("2026-01-01T05:00:00Z"))).toBe("2026-W01");
  });

  it("all_time returns the literal sentinel", () => {
    expect(periodKeyOf("all_time", new Date())).toBe("all_time");
  });
});

describe("periodRange (VN+07)", () => {
  it("daily range spans the VN-local day in UTC instants", () => {
    const { start, end } = periodRange("daily", new Date("2026-05-13T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-05-12T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-13T17:00:00.000Z");
  });

  it("monthly range spans VN-local month boundaries", () => {
    const { start, end } = periodRange("monthly", new Date("2026-05-15T08:00:00Z"));
    expect(start.toISOString()).toBe("2026-04-30T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-31T17:00:00.000Z");
  });

  it("weekly range starts Monday 00:00 VN", () => {
    const { start, end } = periodRange("weekly", new Date("2026-05-13T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-05-10T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-17T17:00:00.000Z");
  });

  it("weekly range when called on Sunday VN does not wrap forward", () => {
    const { start } = periodRange("weekly", new Date("2026-05-17T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-05-10T17:00:00.000Z");
  });
});
