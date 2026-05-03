import { describe, expect, it } from "vitest";
import { completeLesson } from "../lessons";
import { enrollInCourse } from "../enroll";
import { getCourseProgress } from "../progress";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function build(slug: string, lessonsPerModule: number[]) {
  const owner = await registerUser(
    { email: `o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const learner = await registerUser(
    { email: `l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  const c = await createCourse(owner.userId, { title: slug, description: "x", slug });
  const skill = await createSkill({ code: `skill.p.${slug}`, name: "s" });
  const moduleIds: string[] = [];
  const lessonIds: string[][] = [];
  for (let mi = 0; mi < lessonsPerModule.length; mi++) {
    const m = await createModule(owner.userId, c.courseId, {
      title: `M${mi}`,
      orderIndex: mi,
    });
    moduleIds.push(m.moduleId);
    const lessons: string[] = [];
    for (let li = 0; li < lessonsPerModule[mi]!; li++) {
      const l = await createLesson(owner.userId, m.moduleId, {
        title: `L${mi}-${li}`,
        orderIndex: li,
      });
      await tagLessonSkill(owner.userId, l.lessonId, { skillId: skill.skillId });
      lessons.push(l.lessonId);
    }
    lessonIds.push(lessons);
  }
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(learner.userId, c.courseId);
  return { learnerId: learner.userId, courseId: c.courseId, moduleIds, lessonIds };
}

describe("getCourseProgress", () => {
  it("AC-A3.7: 0% completion before any lesson done", async () => {
    const { learnerId, courseId } = await build("p1", [2, 2]);
    const p = await getCourseProgress(learnerId, courseId);
    expect(p.totalLessons).toBe(4);
    expect(p.completedLessons).toBe(0);
    expect(p.courseCompletionPct).toBe(0);
    expect(p.modules).toHaveLength(2);
    expect(p.modules.every((m) => m.completionPct === 0)).toBe(true);
    expect(p.modules.every((m) => m.lessons.every((l) => !l.completed))).toBe(true);
  });

  it("partial completion returns correct %s per module + course", async () => {
    const { learnerId, courseId, lessonIds } = await build("p2", [2, 2]);
    // Complete first lesson of module 0.
    await completeLesson(learnerId, lessonIds[0]![0]!);
    const p = await getCourseProgress(learnerId, courseId);
    expect(p.completedLessons).toBe(1);
    expect(p.courseCompletionPct).toBe(25);
    expect(p.modules[0]?.completionPct).toBe(50);
    expect(p.modules[1]?.completionPct).toBe(0);
    expect(p.modules[0]?.lessons[0]?.completed).toBe(true);
    expect(p.modules[0]?.lessons[1]?.completed).toBe(false);
  });

  it("100% after all lessons done", async () => {
    const { learnerId, courseId, lessonIds } = await build("p3", [1, 1]);
    for (const mod of lessonIds) {
      for (const lid of mod) {
        await completeLesson(learnerId, lid);
      }
    }
    const p = await getCourseProgress(learnerId, courseId);
    expect(p.courseCompletionPct).toBe(100);
    expect(p.modules.every((m) => m.completionPct === 100)).toBe(true);
  });
});
