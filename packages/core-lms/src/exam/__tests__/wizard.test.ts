import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import {
  WizardConfig,
  distributeBuckets,
  resolveDifficultyWeights,
  resolveSkillScope,
  resolveBankScope,
  assembleWizardPool,
  previewPool,
} from "../wizard";

const BASE = "http://localhost:3000";

async function newOwner(slug: string) {
  const u = await registerUser(
    { email: `wiz-${slug}@e.com`, password: "password1234", displayName: "W" },
    BASE,
  );
  const c = await createCourse(u.userId, {
    title: `Wizard course ${slug}`,
    description: "x",
    slug: `wiz-course-${slug}`,
  });
  return { ownerId: u.userId, courseId: c.courseId };
}

describe("WizardConfig schema", () => {
  it("rejects bloom mix that doesn't sum to 100", () => {
    expect(
      WizardConfig.safeParse({
        courseId: "00000000-0000-0000-0000-000000000000",
        lessonIds: ["00000000-0000-0000-0000-000000000001"],
        questionCount: 20,
        bloomMix: { remember_understand: 50, apply: 30, analyze_plus: 10 }, // 90
        difficultyProfile: "balanced",
        distributionMode: "single",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid balanced config", () => {
    const r = WizardConfig.safeParse({
      courseId: "00000000-0000-0000-0000-000000000000",
      lessonIds: ["00000000-0000-0000-0000-000000000001"],
      questionCount: 25,
      bloomMix: { remember_understand: 60, apply: 30, analyze_plus: 10 },
      difficultyProfile: "balanced",
      distributionMode: "single",
    });
    expect(r.success).toBe(true);
  });

  it("requires sessionCount when distributionMode = multi_session", () => {
    expect(
      WizardConfig.safeParse({
        courseId: "00000000-0000-0000-0000-000000000000",
        lessonIds: ["00000000-0000-0000-0000-000000000001"],
        questionCount: 25,
        bloomMix: { remember_understand: 60, apply: 30, analyze_plus: 10 },
        difficultyProfile: "balanced",
        distributionMode: "multi_session",
      }).success,
    ).toBe(false);
  });
});

describe("distributeBuckets", () => {
  it("sums to questionCount exactly (rounding drift repaired)", () => {
    const buckets = distributeBuckets(
      25,
      { remember_understand: 60, apply: 30, analyze_plus: 10 },
      [10, 25, 40, 20, 5], // balanced
    );
    const sum = buckets.reduce((a, b) => a + b.count, 0);
    expect(sum).toBe(25);
  });

  it("drops zero-count cells (e.g. challenge profile skips diff=1)", () => {
    const buckets = distributeBuckets(
      30,
      { remember_understand: 0, apply: 50, analyze_plus: 50 },
      [0, 10, 30, 40, 20], // challenge
    );
    for (const b of buckets) {
      expect(b.count).toBeGreaterThan(0);
      // No remember_understand because bloom% = 0
      expect(b.cognitiveLevel).not.toBe("remember_understand");
      // No difficulty=1 because diff weight = 0
      expect(b.difficulty).not.toBe(1);
    }
    expect(buckets.reduce((a, b) => a + b.count, 0)).toBe(30);
  });

  it("handles small total without losing questions", () => {
    const buckets = distributeBuckets(
      5,
      { remember_understand: 60, apply: 30, analyze_plus: 10 },
      [10, 25, 40, 20, 5],
    );
    expect(buckets.reduce((a, b) => a + b.count, 0)).toBe(5);
  });
});

describe("resolveDifficultyWeights", () => {
  it("returns hard-coded vector for non-adaptive profiles", async () => {
    const { courseId } = await newOwner("rdw1");
    const r = await resolveDifficultyWeights("basic", courseId);
    expect(r.weights).toEqual([30, 40, 30, 0, 0]);
    expect(r.fallbackUsed).toBe(false);
  });

  it("falls back to balanced when course has no LearnerSkillState", async () => {
    const { courseId } = await newOwner("rdw2");
    const r = await resolveDifficultyWeights("adaptive_to_class", courseId);
    expect(r.weights).toEqual([10, 25, 40, 20, 5]);
    expect(r.fallbackUsed).toBe(true);
  });
});

describe("resolveSkillScope + resolveBankScope", () => {
  it("returns empty arrays for course with no lessons or banks", async () => {
    const { ownerId, courseId } = await newOwner("scope1");
    const skills = await resolveSkillScope([]);
    expect(skills).toEqual([]);
    const banks = await resolveBankScope(courseId, ownerId);
    expect(banks).toEqual([]);
  });

  it("includes course-visible and owner's private banks", async () => {
    const { ownerId, courseId } = await newOwner("scope2");
    const courseBank = await prisma.questionBank.create({
      data: { ownerUserId: ownerId, courseId, name: "C", visibility: "course" },
    });
    const privateBank = await prisma.questionBank.create({
      data: { ownerUserId: ownerId, name: "P", visibility: "private" },
    });
    const banks = await resolveBankScope(courseId, ownerId);
    expect(banks.sort()).toEqual([courseBank.id, privateBank.id].sort());
  });
});

describe("assembleWizardPool + previewPool", () => {
  it("reports emptyScope when course has no banks/lessons tagged", async () => {
    const { ownerId, courseId } = await newOwner("aw1");
    const preview = await previewPool(
      {
        courseId,
        lessonIds: ["00000000-0000-0000-0000-000000000001"], // non-existent lesson
        questionCount: 25,
        bloomMix: { remember_understand: 60, apply: 30, analyze_plus: 10 },
        difficultyProfile: "balanced",
        distributionMode: "single",
        autoEquating: true,
      },
      ownerId,
    );
    expect(preview.emptyScope).toBe(true);
    expect(preview.totalAvailable).toBe(0);
    expect(preview.deficits.length).toBeGreaterThan(0);
  });

  it("counts available bank questions per bucket and reports deficits", async () => {
    const { ownerId, courseId } = await newOwner("aw2");
    // Create a course bank with a few items tagged with various cognitiveLevels.
    const bank = await prisma.questionBank.create({
      data: { ownerUserId: ownerId, courseId, name: "B", visibility: "course" },
    });
    // 5 easy "remember_understand" items at difficulty=2 (and a skill so scope is non-empty).
    // Insert lesson + skill mapping so the skill scope is non-empty.
    const skill = await prisma.skill.create({
      data: { code: `s-aw2`, name: "S" },
    });
    const moduleRow = await prisma.module.create({
      data: { courseId, title: "M", orderIndex: 0 },
    });
    const lesson = await prisma.lesson.create({
      data: { moduleId: moduleRow.id, title: "L", orderIndex: 0 },
    });
    await prisma.contentSkillMapping.create({
      data: { contentType: "lesson", contentId: lesson.id, skillId: skill.id },
    });
    for (let i = 0; i < 5; i++) {
      const q = await prisma.bankQuestion.create({
        data: {
          bankId: bank.id,
          type: "mcq",
          prompt: `Q${i}`,
          config: { options: [{ id: "a", label: "A", isCorrect: true }] },
          difficulty: 2,
          cognitiveLevel: "remember_understand",
          status: "published",
        },
      });
      await prisma.bankQuestionSkillTag.create({
        data: { bankQuestionId: q.id, skillId: skill.id },
      });
    }

    const preview = await previewPool(
      {
        courseId,
        lessonIds: [lesson.id],
        questionCount: 10,
        // Only target remember_understand at difficulty 2 → bucket should ask
        // for 10 but pool only has 5 → deficit 5.
        bloomMix: { remember_understand: 100, apply: 0, analyze_plus: 0 },
        difficultyProfile: "basic", // [30,40,30,0,0] but only diff=2 is 40% — others contribute too
        distributionMode: "single",
        autoEquating: true,
      },
      ownerId,
    );

    expect(preview.emptyScope).toBe(false);
    // We requested 10 total; pool only has items at difficulty=2; deficit > 0.
    expect(preview.totalAvailable).toBeLessThan(10);
    expect(preview.deficits.length).toBeGreaterThan(0);
  });

  it("assembleWizardPool returns buckets summing to questionCount", async () => {
    const { ownerId, courseId } = await newOwner("aw3");
    const { poolFilter } = await assembleWizardPool(
      {
        courseId,
        lessonIds: ["00000000-0000-0000-0000-000000000001"],
        questionCount: 25,
        bloomMix: { remember_understand: 60, apply: 30, analyze_plus: 10 },
        difficultyProfile: "balanced",
        distributionMode: "single",
        autoEquating: true,
      },
      ownerId,
    );
    expect(poolFilter.count).toBe(25);
    expect(poolFilter.buckets.reduce((a, b) => a + b.count, 0)).toBe(25);
  });
});
