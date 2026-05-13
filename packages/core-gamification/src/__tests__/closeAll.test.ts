import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { closeDueLeaderboards, periodsDueAt } from "../leaderboard/closeAll";

describe("periodsDueAt (VN+07)", () => {
  it("daily only on a normal weekday", () => {
    // 2026-05-13 is Wednesday VN → only daily.
    expect(periodsDueAt(new Date("2026-05-13T00:00:00Z"))).toEqual(["daily"]);
  });
  it("daily + weekly on a Monday VN", () => {
    // 2026-05-18 is Monday VN.
    expect(periodsDueAt(new Date("2026-05-17T17:30:00Z"))).toEqual(["daily", "weekly"]);
  });
  it("daily + monthly on day 1 VN that is not a Monday", () => {
    // 2026-03-01 is a Sunday in VN.
    expect(periodsDueAt(new Date("2026-02-28T17:30:00Z"))).toEqual(["daily", "monthly"]);
  });
  it("all three when day 1 is also a Monday", () => {
    // 2026-06-01 is a Monday in VN.
    expect(periodsDueAt(new Date("2026-06-01T00:30:00Z"))).toEqual(["daily", "weekly", "monthly"]);
  });
});

describe("closeDueLeaderboards", () => {
  async function makeUser(): Promise<string> {
    const u = await prisma.user.create({
      data: { email: `ca-${Math.random()}@e.com`, passwordHash: "x", displayName: "n" },
    });
    return u.id;
  }
  async function makePublishedCourse(): Promise<string> {
    const c = await prisma.course.create({
      data: {
        slug: `ca-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "C",
        description: "x",
        status: "published",
        publishedAt: new Date(),
      },
    });
    return c.id;
  }

  it("closes global + course-scope for every due period on a Monday VN", async () => {
    const c = await makePublishedCourse();
    const u = await makeUser();
    // Yesterday VN (W19 end) — Sun 2026-05-17 — XP both buckets observe.
    await prisma.xpTransaction.create({
      data: {
        userId: u, courseId: c, amount: 25, reason: "lesson.completed",
        sourceId: `s-${Math.random()}`,
        occurredAt: new Date("2026-05-17T08:00:00Z"), // 15:00 VN Sun
      },
    });

    // Run at 2026-05-18 00:05 VN = Mon → daily + weekly due.
    const res = await closeDueLeaderboards(new Date("2026-05-17T17:05:00Z"));
    expect(res.periods).toEqual(["daily", "weekly"]);

    // Verify global daily snapshot for 2026-05-17 has u.
    const dailyGlobal = await prisma.leaderboardEntry.findFirst({
      where: { scope: "global", courseId: null, period: "daily", periodKey: "2026-05-17", userId: u },
    });
    expect(dailyGlobal?.xp).toBe(25);
    // Verify course-scoped weekly snapshot for 2026-W20? No — VN week of 2026-05-17 is W20.
    // Actually 2026-05-17 (Sun) belongs to the week starting Mon 2026-05-11 = W20.
    const weeklyCourse = await prisma.leaderboardEntry.findFirst({
      where: { scope: "course", courseId: c, period: "weekly", periodKey: "2026-W20", userId: u },
    });
    expect(weeklyCourse?.xp).toBe(25);
  });

  it("draft courses are not closed (only published)", async () => {
    const draft = await prisma.course.create({
      data: { slug: `d-${Math.random()}`, title: "D", description: "x", status: "draft" },
    });
    const u = await makeUser();
    await prisma.xpTransaction.create({
      data: {
        userId: u, courseId: draft.id, amount: 5, reason: "lesson.completed",
        sourceId: `s-${Math.random()}`,
        occurredAt: new Date("2026-05-19T08:00:00Z"),
      },
    });

    // Run at 2026-05-20 00:05 VN — daily only.
    await closeDueLeaderboards(new Date("2026-05-19T17:05:00Z"));

    const draftSnap = await prisma.leaderboardEntry.findFirst({
      where: { scope: "course", courseId: draft.id, period: "daily", periodKey: "2026-05-19" },
    });
    expect(draftSnap).toBeNull();
  });

  it("safe to re-run (idempotent across full orchestration)", async () => {
    const c = await makePublishedCourse();
    const u = await makeUser();
    await prisma.xpTransaction.create({
      data: {
        userId: u, courseId: c, amount: 11, reason: "lesson.completed",
        sourceId: `s-${Math.random()}`,
        occurredAt: new Date("2026-05-21T08:00:00Z"),
      },
    });
    const asOf = new Date("2026-05-21T17:05:00Z");
    const a = await closeDueLeaderboards(asOf);
    const b = await closeDueLeaderboards(asOf);
    const wroteFirst = a.results.reduce((n, r) => n + r.snapshotWritten, 0);
    const wroteSecond = b.results.reduce((n, r) => n + r.snapshotWritten, 0);
    expect(wroteFirst).toBeGreaterThan(0);
    expect(wroteSecond).toBe(0);
  });
});
