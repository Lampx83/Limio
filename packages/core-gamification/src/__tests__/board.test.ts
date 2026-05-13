import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { getLeaderboard, previousPeriodKey } from "../leaderboard/board";
import { periodKeyOf } from "../leaderboard/periodKey";
import { awardXp } from "../xp";

async function makeUser(name: string, optOut = false): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `bd-${name}-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: name,
      leaderboardOptOut: optOut,
    },
  });
  return u.id;
}

async function makeCourse(): Promise<string> {
  const c = await prisma.course.create({
    data: {
      slug: `bd-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "C",
      description: "x",
    },
  });
  return c.id;
}

async function grant(userId: string, courseId: string, amount: number, src: string) {
  await awardXp({ userId, courseId, amount, reason: "lesson.completed", sourceId: src });
}

describe("getLeaderboard — global / multi-period", () => {
  it("ranks by total XP across courses for global scope", async () => {
    const cA = await makeCourse();
    const cB = await makeCourse();
    const u1 = await makeUser("u1");
    const u2 = await makeUser("u2");
    await grant(u1, cA, 30, "s1");
    await grant(u1, cB, 20, "s2"); // u1 total = 50
    await grant(u2, cA, 40, "s3"); // u2 total = 40

    const lb = await getLeaderboard({ scope: "global", period: "weekly" });
    const mine = lb.entries.filter((e) => e.userId === u1 || e.userId === u2);
    expect(mine).toHaveLength(2);
    expect(mine[0]!.userId).toBe(u1);
    expect(mine[0]!.xp).toBe(50);
    expect(mine[1]!.userId).toBe(u2);
    expect(mine[1]!.xp).toBe(40);
  });

  it("filters by courseId when scope=course", async () => {
    const cA = await makeCourse();
    const cB = await makeCourse();
    const u1 = await makeUser("u1");
    await grant(u1, cA, 30, "s1");
    await grant(u1, cB, 100, "s2");

    const lb = await getLeaderboard({ scope: "course", courseId: cA, period: "weekly" });
    const me = lb.entries.find((e) => e.userId === u1);
    expect(me?.xp).toBe(30);
  });

  it("excludes opted-out users from entries and returns me=null with selfOptedOut=true", async () => {
    const c = await makeCourse();
    const u = await makeUser("opt", true);
    await grant(u, c, 50, "s1");

    const lb = await getLeaderboard({
      scope: "global",
      period: "weekly",
      viewerId: u,
    });
    expect(lb.entries.find((e) => e.userId === u)).toBeUndefined();
    expect(lb.me).toBeNull();
    expect(lb.selfOptedOut).toBe(true);
  });

  it("returns me={rank,xp,delta} for viewer outside top-N", async () => {
    const c = await makeCourse();
    const viewer = await makeUser("viewer");
    await grant(viewer, c, 5, "s-v");
    // 3 louder users above
    for (let i = 0; i < 3; i++) {
      const u = await makeUser(`loud-${i}`);
      await grant(u, c, 100 + i, `s-${i}`);
    }
    const lb = await getLeaderboard({
      scope: "global",
      period: "weekly",
      viewerId: viewer,
      limit: 1,
    });
    expect(lb.entries).toHaveLength(1);
    expect(lb.me?.rank).toBeGreaterThanOrEqual(2);
    expect(lb.me?.xp).toBe(5);
    expect(lb.me?.delta).toBeNull(); // no prior snapshot
  });

  it("computes delta as previousRank - currentRank from LeaderboardEntry snapshot", async () => {
    const c = await makeCourse();
    const u = await makeUser("climber");
    await grant(u, c, 100, "s1");

    // Seed a snapshot for the previous weekly bucket where this user was rank 5.
    const now = new Date();
    const prevKey = previousPeriodKey("weekly", now)!;
    await prisma.leaderboardEntry.create({
      data: {
        scope: "global",
        courseId: null,
        period: "weekly",
        periodKey: prevKey,
        userId: u,
        rank: 5,
        xp: 10,
      },
    });

    const lb = await getLeaderboard({ scope: "global", period: "weekly", viewerId: u });
    const me = lb.entries.find((e) => e.userId === u);
    expect(me).toBeDefined();
    expect(me!.delta).toBe(5 - me!.rank); // climbed by (5 - currentRank)
    expect(lb.me?.delta).toBe(5 - lb.me!.rank);
  });

  it("all_time period has no delta (previousPeriodKey null)", async () => {
    expect(previousPeriodKey("all_time", new Date())).toBeNull();
    const c = await makeCourse();
    const u = await makeUser("ageless");
    await grant(u, c, 7, "s1");
    const lb = await getLeaderboard({ scope: "global", period: "all_time", viewerId: u });
    const me = lb.entries.find((e) => e.userId === u);
    expect(me?.delta).toBeNull();
  });

  it("does not count capped (amount=0) XP rows", async () => {
    const c = await makeCourse();
    const u = await makeUser("capped");
    // Burn through the daily cap for lesson.completed (10/day, see xp.ts DAILY_CAPS).
    for (let i = 0; i < 12; i++) {
      await grant(u, c, 5, `cap-${i}`); // some will be capped → amount=0
    }
    const lb = await getLeaderboard({ scope: "global", period: "daily", viewerId: u });
    const me = lb.entries.find((e) => e.userId === u);
    // 10 award caps × 5 = 50 max; if the cap is in count not xp, then capped rows have amount=0 → ignored.
    expect(me?.xp).toBeLessThanOrEqual(50);
    expect(me?.xp).toBeGreaterThan(0);
  });

  it("periodKey in response matches periodKeyOf(period, now)", async () => {
    const lb = await getLeaderboard({ scope: "global", period: "daily" });
    expect(lb.periodKey).toBe(periodKeyOf("daily"));
  });
});

describe("previousPeriodKey", () => {
  it("daily bucket steps back one VN-day", () => {
    // 2026-05-13 12:00 UTC = 2026-05-13 19:00 VN → prev = 2026-05-12.
    expect(previousPeriodKey("daily", new Date("2026-05-13T12:00:00Z"))).toBe("2026-05-12");
  });
  it("weekly bucket steps back one ISO week (VN)", () => {
    expect(previousPeriodKey("weekly", new Date("2026-05-13T12:00:00Z"))).toBe("2026-W19");
  });
  it("monthly bucket steps back to prior month, handles year edge", () => {
    expect(previousPeriodKey("monthly", new Date("2026-01-15T05:00:00Z"))).toBe("2025-12");
  });
});
