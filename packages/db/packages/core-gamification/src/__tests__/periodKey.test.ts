import { describe, expect, it } from "vitest";
import { periodKeyOf, periodRange } from "../leaderboard/periodKey";

// VN is UTC+07, no DST. Helper assertion: "2026-05-13T16:59:59Z" is
// 2026-05-13 23:59:59 VN, and "2026-05-13T17:00:00Z" is 2026-05-14 00:00 VN.

describe("periodKeyOf (VN+07)", () => {
  it("daily key uses VN-local date, not UTC date", () => {
    // 23:59 VN on May 13 (= 16:59 UTC) still bucketed as 2026-05-13.
    expect(periodKeyOf("daily", new Date("2026-05-13T16:59:59Z"))).toBe("2026-05-13");
    // 00:00 VN on May 14 (= 17:00 UTC on May 13) bucketed as 2026-05-14.
    expect(periodKeyOf("daily", new Date("2026-05-13T17:00:00Z"))).toBe("2026-05-14");
  });

  it("monthly key rolls over at VN midnight, not UTC midnight", () => {
    // 23:30 VN on May 31 → still 2026-05
    expect(periodKeyOf("monthly", new Date("2026-05-31T16:30:00Z"))).toBe("2026-05");
    // 00:30 VN on Jun 1 → 2026-06
    expect(periodKeyOf("monthly", new Date("2026-05-31T17:30:00Z"))).toBe("2026-06");
  });

  it("weekly key uses ISO week of VN-local date", () => {
    // 2026-05-13 is a Wednesday → ISO week 20 of 2026.
    expect(periodKeyOf("weekly", new Date("2026-05-13T12:00:00Z"))).toBe("2026-W20");
    // 2026-05-11 (Mon) and 2026-05-17 (Sun) — same week.
    expect(periodKeyOf("weekly", new Date("2026-05-11T03:00:00Z"))).toBe("2026-W20");
    expect(periodKeyOf("weekly", new Date("2026-05-17T03:00:00Z"))).toBe("2026-W20");
    // Crossing into Monday 2026-05-18 in VN time (= 17:00 UTC on May 17).
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
    // VN 2026-05-13 00:00 = UTC 2026-05-12 17:00
    expect(start.toISOString()).toBe("2026-05-12T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-13T17:00:00.000Z");
  });

  it("monthly range spans VN-local month boundaries", () => {
    const { start, end } = periodRange("monthly", new Date("2026-05-15T08:00:00Z"));
    expect(start.toISOString()).toBe("2026-04-30T17:00:00.000Z"); // 2026-05-01 00:00 VN
    expect(end.toISOString()).toBe("2026-05-31T17:00:00.000Z"); // 2026-06-01 00:00 VN
  });

  it("weekly range starts Monday 00:00 VN", () => {
    // 2026-05-13 is Wed → Monday is 2026-05-11.
    const { start, end } = periodRange("weekly", new Date("2026-05-13T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-05-10T17:00:00.000Z"); // Mon 2026-05-11 00:00 VN
    expect(end.toISOString()).toBe("2026-05-17T17:00:00.000Z"); // Mon 2026-05-18 00:00 VN
  });

  it("weekly range when called on Sunday VN does not wrap forward", () => {
    // 2026-05-17 03:00 UTC = 2026-05-17 10:00 VN (Sunday) → still W20.
    const { start } = periodRange("weekly", new Date("2026-05-17T03:00:00Z"));
    expect(start.toISOString()).toBe("2026-05-10T17:00:00.000Z");
  });
});
