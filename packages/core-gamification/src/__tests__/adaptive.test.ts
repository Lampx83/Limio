import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { adaptiveMultiplier, onQuizSubmitted } from "../handlers";
import { awardSkillMasterBadges, listUserBadges } from "../badges";

describe("adaptiveMultiplier (D3 — pure)", () => {
  it("AC-D3.6: null → 1.0 (cold start)", () => {
    expect(adaptiveMultiplier(null)).toBe(1.0);
  });
  it("AC-D3.2: > 0.85 → 0.5", () => {
    expect(adaptiveMultiplier(0.86)).toBe(0.5);
    expect(adaptiveMultiplier(0.95)).toBe(0.5);
  });
  it("AC-D3.3: > 0.6 (≤ 0.85) → 0.8", () => {
    expect(adaptiveMultiplier(0.61)).toBe(0.8);
    expect(adaptiveMultiplier(0.85)).toBe(0.8);
  });
  it("AC-D3.4: < 0.3 → 1.5", () => {
    expect(adaptiveMultiplier(0.0)).toBe(1.5);
    expect(adaptiveMultiplier(0.29)).toBe(1.5);
  });
  it("AC-D3.5: middle band → 1.0", () => {
    expect(adaptiveMultiplier(0.3)).toBe(1.0);
    expect(adaptiveMultiplier(0.5)).toBe(1.0);
    expect(adaptiveMultiplier(0.6)).toBe(1.0);
  });
});

async function makeUserCourse() {
  const user = await prisma.user.create({
    data: {
      email: `a-${Date.now()}-${Math.random()}@e.com`,
      passwordHash: "x",
      displayName: "U",
    },
  });
  const course = await prisma.course.create({
    data: {
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "C",
      description: "x",
    },
  });
  return { userId: user.id, courseId: course.id };
}

describe("onQuizSubmitted with D3 multiplier", () => {
  it("AC-D3.7: high mastery (0.9) → multiplier 0.5 → 50 × 1 × 0.5 = 25 XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "a1", quizId: "q1",
      difficulty: 1, isFirstPass: true, elapsedSec: 60, scorePct: 100,
      avgMastery: 0.9,
    });
    expect(r.adaptiveMultiplier).toBe(0.5);
    expect(r.xp?.amountGranted).toBe(25);
    expect(r.avgMastery).toBe(0.9);
  });

  it("AC-D3.4: low mastery (0.2) → multiplier 1.5 → 50 × 1 × 1.5 = 75 XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "a2", quizId: "q1",
      difficulty: 1, isFirstPass: true, elapsedSec: 60, scorePct: 100,
      avgMastery: 0.2,
    });
    expect(r.adaptiveMultiplier).toBe(1.5);
    expect(r.xp?.amountGranted).toBe(75);
  });

  it("AC-D3.6: null avgMastery → multiplier 1.0 → unchanged 50 XP", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "a3", quizId: "q1",
      difficulty: 1, isFirstPass: true, elapsedSec: 60, scorePct: 100,
      avgMastery: null,
    });
    expect(r.adaptiveMultiplier).toBe(1.0);
    expect(r.xp?.amountGranted).toBe(50);
  });

  it("xp.awarded event payload includes baseAmount, adaptiveMultiplier, avgMastery", async () => {
    const { userId, courseId } = await makeUserCourse();
    await onQuizSubmitted({
      userId, courseId, attemptId: "a4", quizId: "q1",
      difficulty: 2, isFirstPass: true, elapsedSec: 60, scorePct: 100,
      avgMastery: 0.7,
    });
    const ev = await prisma.learningEvent.findFirstOrThrow({
      where: { userId, eventType: LearningEventType.XpAwarded },
    });
    const p = ev.payload as Record<string, unknown>;
    expect(p.baseAmount).toBe(100); // 50 × 2
    expect(p.adaptiveMultiplier).toBe(0.8);
    expect(p.avgMastery).toBe(0.7);
    expect(p.amount).toBe(80);
  });

  it("speed-run still bypasses (0 XP regardless of multiplier)", async () => {
    const { userId, courseId } = await makeUserCourse();
    const r = await onQuizSubmitted({
      userId, courseId, attemptId: "a5", quizId: "q1",
      difficulty: 1, isFirstPass: true, elapsedSec: 5, scorePct: 100,
      avgMastery: 0.2,
    });
    expect(r.xp?.amountGranted).toBe(0);
  });
});

describe("awardSkillMasterBadges (D4)", () => {
  it("AC-D4.2: auto-creates Badge row on first award", async () => {
    const { userId } = await makeUserCourse();
    const skill = await prisma.skill.create({
      data: { code: "m.algebra", name: "Algebra" },
    });
    await awardSkillMasterBadges({
      userId,
      skills: [
        { skillId: skill.id, skillCode: skill.code, skillName: skill.name },
      ],
    });
    const badge = await prisma.badge.findUniqueOrThrow({
      where: { code: `skill_master:${skill.code}` },
    });
    expect(badge.category).toBe("skill");
    expect(badge.emoji).toBe("🏆");
    expect(badge.name).toContain("Algebra");

    const userBadges = await listUserBadges(userId);
    expect(userBadges.map((u) => u.badge.code)).toContain(`skill_master:${skill.code}`);
  });

  it("AC-D4.3: idempotent on second call (P2002 swallow)", async () => {
    const { userId } = await makeUserCourse();
    const skill = await prisma.skill.create({
      data: { code: "m.linear", name: "Linear" },
    });
    const r1 = await awardSkillMasterBadges({
      userId,
      skills: [
        { skillId: skill.id, skillCode: skill.code, skillName: skill.name },
      ],
    });
    const r2 = await awardSkillMasterBadges({
      userId,
      skills: [
        { skillId: skill.id, skillCode: skill.code, skillName: skill.name },
      ],
    });
    expect(r1.awarded).toHaveLength(1);
    expect(r2.awarded).toHaveLength(0);
  });

  it("AC-D4.5: emits badge.earned event with skill context", async () => {
    const { userId } = await makeUserCourse();
    const skill = await prisma.skill.create({
      data: { code: "m.calc", name: "Calc" },
    });
    await awardSkillMasterBadges({
      userId,
      skills: [
        { skillId: skill.id, skillCode: skill.code, skillName: skill.name },
      ],
    });
    const ev = await prisma.learningEvent.findFirstOrThrow({
      where: { userId, eventType: LearningEventType.BadgeEarned },
    });
    const p = ev.payload as Record<string, unknown>;
    expect(p.badgeCode).toBe(`skill_master:${skill.code}`);
    const ctx = p.context as Record<string, unknown>;
    expect(ctx.skillId).toBe(skill.id);
    expect(ctx.skillCode).toBe(skill.code);
  });

  it("multiple skills → multiple badges", async () => {
    const { userId } = await makeUserCourse();
    const a = await prisma.skill.create({ data: { code: "m.a", name: "A" } });
    const b = await prisma.skill.create({ data: { code: "m.b", name: "B" } });
    const r = await awardSkillMasterBadges({
      userId,
      skills: [
        { skillId: a.id, skillCode: a.code, skillName: a.name },
        { skillId: b.id, skillCode: b.code, skillName: b.name },
      ],
    });
    expect(r.awarded).toHaveLength(2);
  });
});
