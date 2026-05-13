import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { closePeriod } from "../leaderboard/closePeriod";
import { getLeaderboard } from "../leaderboard/board";
import { periodKeyOf, periodRange } from "../leaderboard/periodKey";
import { awardXp } from "../xp";

async function makeUser(name: string): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `cp-${name}-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: name,
    },
  });
  return u.id;
}

async function makeCourse(): Promise<string> {
  const c = await prisma.course.create({
    data: {
      slug: `cp-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "C",
      description: "x",
    },
  });
  return c.id;
}

// Seed an XpTransaction directly with a controlled occurredAt — awardXp
// uses now() and we need to backdate rows into the previous bucket.
async function seedXp(userId: string, courseId: string, amount: number, occurredAt: Date, tag: string) {
  await prisma.xpTransaction.create({
    data: {
      userId,
      courseId,
      amount,
      reason: "lesson.completed",
      sourceId: `${tag}-${Math.random()}`,
      occurredAt,
    },
  });
}

describe("closePeriod", () => {
  it("snapshots top-N of the JUST-ENDED daily bucket and emits events", async () => {
    const c = await makeCourse();
    const u1 = await makeUser("c-u1");
    const u2 = await makeUser("c-u2");
    const u3 = await makeUser("c-u3");

    // `asOf` = today's bucket. We seed XP into YESTERDAY's bucket.
    const asOf = new Date("2026-05-14T08:00:00Z"); // 15:00 VN, May 14
    const yesterdayMid = new Date("2026-05-13T05:00:00Z"); // 12:00 VN, May 13

    await seedXp(u1, c, 100, yesterdayMid, "u1");
    await seedXp(u2, c, 50, yesterdayMid, "u2");
    await seedXp(u3, c, 30, yesterdayMid, "u3");

    const res = await closePeriod({ scope: "global", period: "daily", asOf });

    expect(res.periodKey).toBe("2026-05-13");
    expect(res.participants).toBe(3);
    expect(res.snapshotWritten).toBe(3);
    expect(res.eventsEmitted).toBe(3);

    const snaps = await prisma.leaderboardEntry.findMany({
      where: { scope: "global", period: "daily", periodKey: "2026-05-13", userId: { in: [u1, u2, u3] } },
      orderBy: { rank: "asc" },
    });
    expect(snaps.map((s) => s.userId)).toEqual([u1, u2, u3]);
    expect(snaps.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(snaps.map((s) => s.xp)).toEqual([100, 50, 30]);

    const events = await prisma.learningEvent.findMany({
      where: { eventType: "leaderboard.updated", userId: { in: [u1, u2, u3] } },
    });
    expect(events).toHaveLength(3);
  });

  it("is idempotent — re-running the same close does not duplicate rows or events", async () => {
    const c = await makeCourse();
    const u = await makeUser("idem");
    const asOf = new Date("2026-05-14T08:00:00Z");
    await seedXp(u, c, 42, new Date("2026-05-13T05:00:00Z"), "idem");

    const r1 = await closePeriod({ scope: "global", period: "daily", asOf });
    const r2 = await closePeriod({ scope: "global", period: "daily", asOf });

    expect(r1.snapshotWritten).toBeGreaterThanOrEqual(1);
    expect(r2.snapshotWritten).toBe(0); // skipDuplicates → 0 new
    // Second run also emits 0 events for users already notified.
    expect(r2.eventsEmitted).toBe(0);

    const rows = await prisma.leaderboardEntry.findMany({
      where: { userId: u, periodKey: "2026-05-13" },
    });
    expect(rows).toHaveLength(1);

    const events = await prisma.learningEvent.findMany({
      where: { userId: u, eventType: "leaderboard.updated" },
    });
    expect(events).toHaveLength(1);
  });

  it("scope=course only counts that course's XP", async () => {
    const cA = await makeCourse();
    const cB = await makeCourse();
    const u = await makeUser("split");
    const asOf = new Date("2026-05-14T08:00:00Z");
    await seedXp(u, cA, 10, new Date("2026-05-13T05:00:00Z"), "a");
    await seedXp(u, cB, 99, new Date("2026-05-13T05:00:00Z"), "b");

    const res = await closePeriod({ scope: "course", courseId: cA, period: "daily", asOf });
    expect(res.snapshotWritten).toBe(1);

    const snap = await prisma.leaderboardEntry.findFirstOrThrow({
      where: { scope: "course", courseId: cA, periodKey: "2026-05-13", userId: u },
    });
    expect(snap.xp).toBe(10);
  });

  it("snapshot feeds the NEXT period's delta in getLeaderboard", async () => {
    const c = await makeCourse();
    const u = await makeUser("ladder");

    // Step 1: seed yesterday with u at xp=1 (would be rank ~last)
    const asOf = new Date("2026-05-14T08:00:00Z");
    await seedXp(u, c, 1, new Date("2026-05-13T05:00:00Z"), "yest");
    // Add 4 louder users so u lands at rank 5 yesterday.
    for (let i = 0; i < 4; i++) {
      const loud = await makeUser(`loud-y-${i}`);
      await seedXp(loud, c, 100 + i, new Date("2026-05-13T05:00:00Z"), `ly-${i}`);
    }

    await closePeriod({ scope: "global", period: "daily", asOf });

    // Step 2: TODAY u earns 999 → should be rank 1, delta = prev(5) - cur(1) = 4
    await seedXp(u, c, 999, new Date("2026-05-14T05:00:00Z"), "today");

    const lb = await getLeaderboard({ scope: "global", period: "daily", viewerId: u, now: asOf });
    const me = lb.entries.find((e) => e.userId === u);
    expect(me?.rank).toBe(1);
    expect(me?.delta).toBe(4);
  });

  it("zero participants — no rows written, no events, no throw", async () => {
    const asOf = new Date("2026-01-02T00:00:00Z");
    const res = await closePeriod({ scope: "global", period: "daily", asOf });
    expect(res.participants).toBe(0);
    expect(res.snapshotWritten).toBe(0);
    expect(res.eventsEmitted).toBe(0);
  });

  it("all_time is a no-op (no bucket boundary)", async () => {
    const res = await closePeriod({ scope: "global", period: "all_time" });
    expect(res.snapshotWritten).toBe(0);
    expect(res.periodKey).toBe("all_time");
  });

  it("computes the right prev-bucket boundaries for weekly closes", async () => {
    // Run on Monday 2026-05-18 09:00 VN (= 2026-05-18 02:00 UTC).
    // Just-ended week = W20 (Mon 2026-05-11 → Sun 2026-05-17, VN).
    const asOf = new Date("2026-05-18T02:00:00Z");
    const c = await makeCourse();
    const u = await makeUser("week-u");
    // XP earned mid-W20 — Wed 2026-05-13 10:00 VN
    await seedXp(u, c, 77, new Date("2026-05-13T03:00:00Z"), "w20");

    const res = await closePeriod({ scope: "global", period: "weekly", asOf });
    expect(res.periodKey).toBe("2026-W20");
    expect(res.snapshotWritten).toBe(1);

    // Sanity: range is the W20 VN week as UTC instants.
    const expected = periodRange("weekly", new Date("2026-05-13T03:00:00Z"));
    expect(res.rangeStart.toISOString()).toBe(expected.start.toISOString());
    expect(res.rangeEnd.toISOString()).toBe(expected.end.toISOString());
    // And matches periodKeyOf for any instant inside that week.
    expect(periodKeyOf("weekly", new Date("2026-05-13T03:00:00Z"))).toBe("2026-W20");
  });
});
