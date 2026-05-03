import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { onMisconceptionResolved } from "../handlers";
import { ensureMilestoneBadges } from "../badges";

beforeAll(async () => {
  await ensureMilestoneBadges();
});

async function makeUserCourseMc() {
  const user = await prisma.user.create({
    data: {
      email: `mr-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: "U",
    },
  });
  const course = await prisma.course.create({
    data: {
      slug: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "C",
      description: "x",
    },
  });
  const misconception = await prisma.misconception.create({
    data: {
      code: `mr-mc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "MC",
      description: "x",
    },
  });
  return { userId: user.id, courseId: course.id, misconceptionId: misconception.id };
}

describe("onMisconceptionResolved — D1 cross-cutting bridge", () => {
  it("AC-D1.1: first resolution grants 15 XP with reason 'misconception.resolved'", async () => {
    const { userId, courseId, misconceptionId } = await makeUserCourseMc();
    const r = await onMisconceptionResolved({
      userId,
      courseId,
      misconceptionId,
      attemptId: "A1",
    });
    expect(r.xp.awarded).toBe(true);
    expect(r.xp.amountGranted).toBe(15);
    expect(r.xp.storedReason).toBe("misconception.resolved");
    expect(r.xp.after.xp).toBe(15);

    const tx = await prisma.xpTransaction.findFirstOrThrow({
      where: { userId, reason: "misconception.resolved" },
    });
    expect(tx.amount).toBe(15);
    expect(tx.sourceId).toBe(misconceptionId);
  });

  it("AC-D1.2: same misconception resolved twice → no extra XP (idempotent on sourceId)", async () => {
    const { userId, courseId, misconceptionId } = await makeUserCourseMc();
    await onMisconceptionResolved({ userId, courseId, misconceptionId, attemptId: "A1" });
    const second = await onMisconceptionResolved({
      userId,
      courseId,
      misconceptionId,
      attemptId: "A2",
    });
    expect(second.xp.awarded).toBe(false);

    const progress = await prisma.userCourseProgress.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
    });
    expect(progress.xp).toBe(15);

    // Only one ledger row.
    const txs = await prisma.xpTransaction.findMany({
      where: { userId, reason: "misconception.resolved" },
    });
    expect(txs).toHaveLength(1);
  });

  it("AC-D1.3: two different misconceptions → two separate grants (30 XP total)", async () => {
    const { userId, courseId, misconceptionId: m1 } = await makeUserCourseMc();
    const m2 = await prisma.misconception.create({
      data: { code: `mc2-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: "MC2", description: "y" },
    });
    await onMisconceptionResolved({ userId, courseId, misconceptionId: m1, attemptId: "A1" });
    const r2 = await onMisconceptionResolved({
      userId,
      courseId,
      misconceptionId: m2.id,
      attemptId: "A1",
    });
    expect(r2.xp.awarded).toBe(true);
    expect(r2.xp.amountGranted).toBe(15);
    expect(r2.xp.after.xp).toBe(30);
  });

  it("AC-D1.4: emits xp.awarded event with attemptId in extraEventPayload", async () => {
    const { userId, courseId, misconceptionId } = await makeUserCourseMc();
    await onMisconceptionResolved({
      userId,
      courseId,
      misconceptionId,
      attemptId: "A-traceable",
    });
    const event = await prisma.learningEvent.findFirstOrThrow({
      where: {
        userId,
        eventType: LearningEventType.XpAwarded,
      },
    });
    const payload = event.payload as Record<string, unknown>;
    expect(payload.reason).toBe("misconception.resolved");
    expect(payload.amount).toBe(15);
    expect(payload.sourceId).toBe(misconceptionId);
    expect(payload.attemptId).toBe("A-traceable");
  });

  it("awards cleared_5 badge after the 5th distinct resolution", async () => {
    const { userId, courseId } = await makeUserCourseMc();
    // Seed 4 prior resolved flags directly (simulate prior history).
    for (let i = 0; i < 4; i++) {
      const m = await prisma.misconception.create({
        data: {
          code: `pre-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
          name: `Pre${i}`,
          description: "x",
        },
      });
      await prisma.misconceptionFlag.create({
        data: {
          userId,
          misconceptionId: m.id,
          resolved: true,
          resolvedAt: new Date(),
        },
      });
    }
    // 5th resolution comes through the handler — flag must be created+resolved
    // in this same path so the count query sees it.
    const fifth = await prisma.misconception.create({
      data: {
        code: `fifth-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: "Fifth",
        description: "x",
      },
    });
    await prisma.misconceptionFlag.create({
      data: {
        userId,
        misconceptionId: fifth.id,
        resolved: true,
        resolvedAt: new Date(),
      },
    });
    const r = await onMisconceptionResolved({
      userId,
      courseId,
      misconceptionId: fifth.id,
      attemptId: "A1",
    });
    const codes = r.badges.awarded.map((a) => a.badgeCode);
    expect(codes).toContain("cleared_5");
    expect(codes).not.toContain("cleared_25");
  });

  it("does NOT award cleared_5 when count is below threshold", async () => {
    const { userId, courseId, misconceptionId } = await makeUserCourseMc();
    await prisma.misconceptionFlag.create({
      data: { userId, misconceptionId, resolved: true, resolvedAt: new Date() },
    });
    const r = await onMisconceptionResolved({
      userId,
      courseId,
      misconceptionId,
      attemptId: "A1",
    });
    const codes = r.badges.awarded.map((a) => a.badgeCode);
    expect(codes).not.toContain("cleared_5");
    expect(codes).not.toContain("cleared_25");
  });

  it("AC-D1.5: no daily cap — multiple unique misconceptions in a single day all award", async () => {
    const { userId, courseId } = await makeUserCourseMc();
    // Create 7 misconceptions and resolve them all today (would exceed any 5-cap).
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const m = await prisma.misconception.create({
        data: {
          code: `cap-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
          name: `MC${i}`,
          description: "x",
        },
      });
      ids.push(m.id);
    }
    for (const id of ids) {
      const r = await onMisconceptionResolved({
        userId,
        courseId,
        misconceptionId: id,
        attemptId: `A-${id}`,
      });
      expect(r.xp.amountGranted).toBe(15);
      expect(r.xp.storedReason).toBe("misconception.resolved");
    }
    const progress = await prisma.userCourseProgress.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
    });
    expect(progress.xp).toBe(7 * 15);
  });
});
