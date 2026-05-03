import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  getClearedChampionsLeaderboard,
  getCourseLeaderboard,
  setLeaderboardOptOut,
} from "../leaderboard";
import { awardXp } from "../xp";

async function makeUser(name: string): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `lb-${name}-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: name,
    },
  });
  return u.id;
}

async function makeCourse(): Promise<string> {
  const c = await prisma.course.create({
    data: {
      slug: `lb-c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "C",
      description: "x",
    },
  });
  return c.id;
}

/** Give a user some XP this week — uses awardXp so the row goes through the
 *  same code path as production. */
async function grant(
  userId: string,
  courseId: string,
  amount: number,
  sourceId: string,
) {
  await awardXp({ userId, courseId, amount, reason: "lesson.completed", sourceId });
}

describe("getCourseLeaderboard", () => {
  it("AC-C5.1: returns top 20 sorted by weekly XP desc", async () => {
    const courseId = await makeCourse();
    const userIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = await makeUser(`Alice-${i}`);
      await grant(id, courseId, (i + 1) * 10, `L-${i}`);
      userIds.push(id);
    }
    const lb = await getCourseLeaderboard(courseId, null);
    expect(lb.entries).toHaveLength(5);
    // Highest earner first.
    expect(lb.entries[0]!.weeklyXp).toBe(50);
    expect(lb.entries[4]!.weeklyXp).toBe(10);
    expect(lb.totalParticipants).toBe(5);
  });

  it("AC-C5.2: entry shape includes rank, displayName, level, isYou", async () => {
    const courseId = await makeCourse();
    const me = await makeUser("Me");
    const other = await makeUser("Other");
    await grant(me, courseId, 30, "L1");
    await grant(other, courseId, 50, "L2");
    const lb = await getCourseLeaderboard(courseId, me);
    expect(lb.entries[0]!.userId).toBe(other);
    expect(lb.entries[0]!.isYou).toBe(false);
    expect(lb.entries[1]!.userId).toBe(me);
    expect(lb.entries[1]!.isYou).toBe(true);
    expect(lb.entries[1]!.rank).toBe(2);
  });

  it("AC-C5.3: opted-out user excluded from results", async () => {
    const courseId = await makeCourse();
    const a = await makeUser("A");
    const b = await makeUser("B");
    await grant(a, courseId, 100, "La");
    await grant(b, courseId, 50, "Lb");
    await setLeaderboardOptOut(a, true);
    const lb = await getCourseLeaderboard(courseId, null);
    expect(lb.entries.map((e) => e.userId)).toEqual([b]);
    expect(lb.totalParticipants).toBe(1);
  });

  it("AC-C5.4: self percentile when not in top 20", async () => {
    const courseId = await makeCourse();
    // 25 users — top 20 + 5 below.
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = await makeUser(`U${i}`);
      // Higher XP for lower index → indexes 0..19 are top 20.
      await grant(id, courseId, (25 - i) * 10, `L-${i}`);
      ids.push(id);
    }
    // Pick user at index 22 (rank 23).
    const lb = await getCourseLeaderboard(courseId, ids[22]!);
    expect(lb.entries).toHaveLength(20);
    // The current user should NOT be in the entries...
    expect(lb.entries.some((e) => e.isYou)).toBe(false);
    // ...but selfRank is filled.
    expect(lb.selfRank).not.toBeNull();
    expect(lb.selfRank?.rank).toBe(23);
    expect(lb.selfRank?.percentile).toBeGreaterThan(80);
  });

  it("AC-C5.6: empty leaderboard when no XP this week", async () => {
    const courseId = await makeCourse();
    const lb = await getCourseLeaderboard(courseId, null);
    expect(lb.entries).toHaveLength(0);
    expect(lb.totalParticipants).toBe(0);
  });

  it("AC-C5.5: only counts XP within current week (Monday UTC)", async () => {
    const courseId = await makeCourse();
    const userId = await makeUser("Z");
    // Insert a row dated 10 days ago directly.
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    await prisma.xpTransaction.create({
      data: {
        userId,
        courseId,
        amount: 999,
        reason: "lesson.completed",
        sourceId: "old",
        occurredAt: tenDaysAgo,
      },
    });
    // Plus 50 today through awardXp.
    await grant(userId, courseId, 50, "today");
    const lb = await getCourseLeaderboard(courseId, null);
    expect(lb.entries[0]!.weeklyXp).toBe(50); // 999 from last week is excluded
  });

  it("AC-C5.8: opted-out current user gets selfOptedOut=true and no selfRank", async () => {
    const courseId = await makeCourse();
    const me = await makeUser("Me");
    await grant(me, courseId, 30, "L1");
    await setLeaderboardOptOut(me, true);
    const lb = await getCourseLeaderboard(courseId, me);
    expect(lb.selfOptedOut).toBe(true);
    expect(lb.selfRank).toBeNull();
  });

  it("speed-run XP (amount=0) is not counted", async () => {
    const courseId = await makeCourse();
    const userId = await makeUser("S");
    // Anti-farm 0-amount row.
    await prisma.xpTransaction.create({
      data: {
        userId, courseId, amount: 0, reason: "quiz.passed.first_try",
        sourceId: "speed_run:x",
      },
    });
    const lb = await getCourseLeaderboard(courseId, null);
    expect(lb.entries).toHaveLength(0);
  });

  it("ties break stably by userId ASC", async () => {
    const courseId = await makeCourse();
    const a = await makeUser("A");
    const b = await makeUser("B");
    await grant(a, courseId, 50, "La");
    await grant(b, courseId, 50, "Lb");
    const lb = await getCourseLeaderboard(courseId, null);
    expect(lb.entries.map((e) => e.userId)).toEqual([a, b].sort());
  });
});

// =====================================================================
// Champion-cleared leaderboard (D2) — top resolvers in the last 7 days,
// course-scoped via misconceptions tagged on this course's quiz options.
// =====================================================================

interface ChampSetup {
  courseId: string;
  miscId: string;
  otherCourseMiscId: string;
}

async function setupChampions(): Promise<ChampSetup> {
  const courseId = await makeCourse();
  const otherCourseId = await makeCourse();

  // Course misconception: tied via QuestionOption to this course's quiz.
  const misc = await prisma.misconception.create({
    data: { code: `mc-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: "M", description: "x" },
  });
  const otherMisc = await prisma.misconception.create({
    data: { code: `mc2-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: "M2", description: "x" },
  });
  for (const [c, m] of [[courseId, misc.id], [otherCourseId, otherMisc.id]]) {
    const quiz = await prisma.quiz.create({ data: { courseId: c, title: "Q" } });
    const q = await prisma.quizQuestion.create({
      data: { quizId: quiz.id, type: "mcq", prompt: "p", points: 1, orderIndex: 0 },
    });
    await prisma.questionOption.create({
      data: { questionId: q.id, label: "right", isCorrect: true, orderIndex: 0 },
    });
    await prisma.questionOption.create({
      data: { questionId: q.id, label: "wrong", isCorrect: false, misconceptionId: m, orderIndex: 1 },
    });
  }
  return { courseId, miscId: misc.id, otherCourseMiscId: otherMisc.id };
}

describe("getClearedChampionsLeaderboard — D2", () => {
  it("ranks users by # course-scoped resolutions in the last 7 days", async () => {
    const s = await setupChampions();
    const u1 = await makeUser("U1"); // 2 resolved (course)
    const u2 = await makeUser("U2"); // 1 resolved (course)
    const u3 = await makeUser("U3"); // 1 resolved (other course only — should NOT count)

    // u1 resolves 2 misconceptions — but the table is keyed (user, misc), so
    // we need 2 different misc ids. Add a second course-scoped misc.
    const m2 = await prisma.misconception.create({
      data: { code: `mc-extra-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: "Mx", description: "x" },
    });
    const quiz2 = await prisma.quiz.findFirstOrThrow({ where: { courseId: s.courseId } });
    const q2 = await prisma.quizQuestion.create({
      data: { quizId: quiz2.id, type: "mcq", prompt: "p2", points: 1, orderIndex: 1 },
    });
    await prisma.questionOption.create({
      data: { questionId: q2.id, label: "right2", isCorrect: true, orderIndex: 0 },
    });
    await prisma.questionOption.create({
      data: { questionId: q2.id, label: "wrong2", isCorrect: false, misconceptionId: m2.id, orderIndex: 1 },
    });

    const now = new Date();
    await prisma.misconceptionFlag.createMany({
      data: [
        { userId: u1, misconceptionId: s.miscId, resolved: true, resolvedAt: now },
        { userId: u1, misconceptionId: m2.id, resolved: true, resolvedAt: now },
        { userId: u2, misconceptionId: s.miscId, resolved: true, resolvedAt: now },
        { userId: u3, misconceptionId: s.otherCourseMiscId, resolved: true, resolvedAt: now },
      ],
    });

    const r = await getClearedChampionsLeaderboard(s.courseId, null);
    expect(r.entries.map((e) => ({ id: e.userId, n: e.resolvedCount }))).toEqual([
      { id: u1, n: 2 },
      { id: u2, n: 1 },
    ]);
    // u3 not in list — their misconception isn't course-scoped.
    expect(r.entries.find((e) => e.userId === u3)).toBeUndefined();
  });

  it("excludes resolutions older than 7 days", async () => {
    const s = await setupChampions();
    const u = await makeUser("U-old");
    const old = new Date(Date.now() - 8 * 24 * 3600 * 1000);
    await prisma.misconceptionFlag.create({
      data: { userId: u, misconceptionId: s.miscId, resolved: true, resolvedAt: old },
    });
    const r = await getClearedChampionsLeaderboard(s.courseId, null);
    expect(r.entries).toEqual([]);
  });

  it("excludes opted-out users", async () => {
    const s = await setupChampions();
    const u = await makeUser("U-opt");
    await setLeaderboardOptOut(u, true);
    await prisma.misconceptionFlag.create({
      data: {
        userId: u,
        misconceptionId: s.miscId,
        resolved: true,
        resolvedAt: new Date(),
      },
    });
    const r = await getClearedChampionsLeaderboard(s.courseId, null);
    expect(r.entries.find((e) => e.userId === u)).toBeUndefined();
  });

  it("flags isYou for current user", async () => {
    const s = await setupChampions();
    const me = await makeUser("Me");
    await prisma.misconceptionFlag.create({
      data: { userId: me, misconceptionId: s.miscId, resolved: true, resolvedAt: new Date() },
    });
    const r = await getClearedChampionsLeaderboard(s.courseId, me);
    expect(r.entries[0]!.isYou).toBe(true);
  });
});
