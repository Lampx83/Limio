import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  FeedbackRatingError,
  getTemplateRatingStats,
  rateFeedback,
} from "../rating";

async function makeUser(slug: string): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `r-${slug}-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: slug,
    },
  });
  return u.id;
}

async function makeDelivery(userId: string, templateId: string | null = null) {
  return prisma.feedbackDelivery.create({
    data: {
      userId,
      body: "msg",
      templateId,
      remediationLessonIds: [],
    },
  });
}

describe("rateFeedback — B6", () => {
  it("sets rating + emits feedback.rated event", async () => {
    const u = await makeUser("rate1");
    const d = await makeDelivery(u);
    await rateFeedback(u, d.id, 5);
    const row = await prisma.feedbackDelivery.findUniqueOrThrow({ where: { id: d.id } });
    expect(row.rating).toBe(5);
    const events = await prisma.learningEvent.findMany({
      where: { userId: u, eventType: LearningEventType.FeedbackRated },
    });
    expect(events).toHaveLength(1);
  });

  it("re-rate updates the row idempotently", async () => {
    const u = await makeUser("rate2");
    const d = await makeDelivery(u);
    await rateFeedback(u, d.id, 5);
    await rateFeedback(u, d.id, 1);
    const row = await prisma.feedbackDelivery.findUniqueOrThrow({ where: { id: d.id } });
    expect(row.rating).toBe(1);
  });

  it("rejects rating outside 1..5", async () => {
    const u = await makeUser("rate3");
    const d = await makeDelivery(u);
    await expect(rateFeedback(u, d.id, 0)).rejects.toBeInstanceOf(FeedbackRatingError);
    await expect(rateFeedback(u, d.id, 6)).rejects.toBeInstanceOf(FeedbackRatingError);
    await expect(rateFeedback(u, d.id, 1.5)).rejects.toBeInstanceOf(FeedbackRatingError);
  });

  it("rejects rating other user's delivery", async () => {
    const u = await makeUser("rate4");
    const other = await makeUser("rate4-other");
    const d = await makeDelivery(u);
    await expect(rateFeedback(other, d.id, 5)).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("getTemplateRatingStats", () => {
  it("aggregates 👍 / 👎 counts and sorts by netScore asc", async () => {
    const u = await makeUser("stats");
    const t1 = await prisma.feedbackTemplate.create({
      data: { scope: "generic", body: "T1" },
    });
    const t2 = await prisma.feedbackTemplate.create({
      data: { scope: "generic", body: "T2" },
    });

    // T1: 1 up, 2 down → net -1 (worst)
    await prisma.feedbackDelivery.create({
      data: { userId: u, body: "x", templateId: t1.id, remediationLessonIds: [], rating: 5 },
    });
    await prisma.feedbackDelivery.create({
      data: { userId: u, body: "x", templateId: t1.id, remediationLessonIds: [], rating: 1 },
    });
    await prisma.feedbackDelivery.create({
      data: { userId: u, body: "x", templateId: t1.id, remediationLessonIds: [], rating: 2 },
    });

    // T2: 3 up, 0 down → net +3
    for (let i = 0; i < 3; i++) {
      await prisma.feedbackDelivery.create({
        data: { userId: u, body: "x", templateId: t2.id, remediationLessonIds: [], rating: 5 },
      });
    }

    const stats = await getTemplateRatingStats();
    const t1Stat = stats.find((s) => s.templateId === t1.id)!;
    const t2Stat = stats.find((s) => s.templateId === t2.id)!;
    expect(t1Stat.thumbsUp).toBe(1);
    expect(t1Stat.thumbsDown).toBe(2);
    expect(t1Stat.netScore).toBe(-1);
    expect(t2Stat.thumbsUp).toBe(3);
    expect(t2Stat.netScore).toBe(3);

    // T1 (worst) should rank before T2 in the sort.
    const idx1 = stats.findIndex((s) => s.templateId === t1.id);
    const idx2 = stats.findIndex((s) => s.templateId === t2.id);
    expect(idx1).toBeLessThan(idx2);
  });
});
