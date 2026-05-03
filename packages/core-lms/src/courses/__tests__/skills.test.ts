import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createSkill, SkillError, tagLessonSkill, untagLessonSkill } from "../skills";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function setup() {
  const r = await registerUser(
    { email: `s${Date.now()}@example.com`, password: "password1234", displayName: "S" },
    BASE,
  );
  const c = await createCourse(r.userId, { title: "Skill tests", description: "x" });
  const m = await createModule(r.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(r.userId, m.moduleId, { title: "L", orderIndex: 0 });
  return { userId: r.userId, lessonId: l.lessonId };
}

describe("skills", () => {
  it("AC-A2.12: createSkill rejects duplicate code", async () => {
    await createSkill({ code: "linear.regression", name: "Linear regression" });
    await expect(
      createSkill({ code: "linear.regression", name: "dup" }),
    ).rejects.toMatchObject({ code: "skill_code_taken" });
  });

  it("createSkill validates code format", async () => {
    await expect(createSkill({ code: "Bad Code!", name: "x" })).rejects.toBeInstanceOf(SkillError);
  });

  it("AC-A2.5: tagLessonSkill creates ContentSkillMapping; idempotent", async () => {
    const { userId, lessonId } = await setup();
    const s = await createSkill({ code: "skill.t1", name: "T1" });
    const r1 = await tagLessonSkill(userId, lessonId, { skillId: s.skillId });
    expect(r1.created).toBe(true);
    const r2 = await tagLessonSkill(userId, lessonId, { skillId: s.skillId });
    expect(r2.created).toBe(false);
    const mappings = await prisma.contentSkillMapping.findMany({
      where: { contentType: "lesson", contentId: lessonId },
    });
    expect(mappings).toHaveLength(1);
  });

  it("untagLessonSkill removes mapping", async () => {
    const { userId, lessonId } = await setup();
    const s = await createSkill({ code: "skill.t2", name: "T2" });
    await tagLessonSkill(userId, lessonId, { skillId: s.skillId });
    await untagLessonSkill(userId, lessonId, s.skillId);
    const mappings = await prisma.contentSkillMapping.findMany({
      where: { contentType: "lesson", contentId: lessonId },
    });
    expect(mappings).toHaveLength(0);
  });

  it("untag returns tag_not_found for missing mapping", async () => {
    const { userId, lessonId } = await setup();
    const s = await createSkill({ code: "skill.t3", name: "T3" });
    await expect(untagLessonSkill(userId, lessonId, s.skillId)).rejects.toMatchObject({
      code: "tag_not_found",
    });
  });

  it("tag with unknown skill throws skill_not_found", async () => {
    const { userId, lessonId } = await setup();
    await expect(
      tagLessonSkill(userId, lessonId, { skillId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toMatchObject({ code: "skill_not_found" });
  });
});
