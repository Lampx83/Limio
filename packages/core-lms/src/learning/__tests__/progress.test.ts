import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
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

  it("module đã ẩn không hiện trong mục lục và không tính vào mẫu số", async () => {
    const { learnerId, courseId, moduleIds, lessonIds } = await build("p4", [2, 2]);

    const before = await getCourseProgress(learnerId, courseId);
    expect(before.totalLessons).toBe(4);
    expect(before.modules).toHaveLength(2);

    await prisma.module.update({
      where: { id: moduleIds[1]! },
      data: { isHidden: true },
    });

    const after = await getCourseProgress(learnerId, courseId);
    // Module ẩn biến mất khỏi mục lục — trước đây nó vẫn hiện đủ tên module và
    // tên từng bài, kể cả khi giảng viên đang chiếu lên máy chiếu.
    expect(after.modules).toHaveLength(1);
    expect(after.modules[0]!.id).toBe(moduleIds[0]);
    expect(after.totalLessons).toBe(2);

    // Và học xong phần đang mở là đạt 100% — không bị kẹt vì mẫu số tính cả
    // những bài chưa mở cho ai.
    for (const lid of lessonIds[0]!) await completeLesson(learnerId, lid);
    const done = await getCourseProgress(learnerId, courseId);
    expect(done.courseCompletionPct).toBe(100);
  });

  it("bài đã ẩn riêng lẻ cũng không tính vào mẫu số", async () => {
    const { learnerId, courseId, lessonIds } = await build("p5", [2]);
    await prisma.lesson.update({
      where: { id: lessonIds[0]![1]! },
      data: { isHidden: true },
    });
    const p = await getCourseProgress(learnerId, courseId);
    expect(p.totalLessons).toBe(1);
    expect(p.modules[0]!.lessons).toHaveLength(1);
  });

  it("bài đã KHOÁ vẫn hiện trong mục lục, có cờ locked, và vẫn tính vào mẫu số", async () => {
    const { learnerId, courseId, moduleIds, lessonIds } = await build("p6", [2, 1]);

    await prisma.lesson.update({
      where: { id: lessonIds[0]![1]! },
      data: { isLocked: true },
    });
    await prisma.module.update({
      where: { id: moduleIds[1]! },
      data: { isLocked: true },
    });

    const p = await getCourseProgress(learnerId, courseId);

    // Khoá KHÁC ẩn: học viên vẫn thấy tên bài, nên nó vẫn nằm trong mục lục và
    // trong mẫu số — họ biết mình còn phải học những gì.
    expect(p.totalLessons).toBe(3);
    expect(p.modules).toHaveLength(2);

    expect(p.modules[0]!.lessons[0]!.locked).toBe(false);
    expect(p.modules[0]!.lessons[1]!.locked).toBe(true);
    // Khoá cả module thì bài bên trong khoá theo, không cần bật cờ từng bài.
    expect(p.modules[1]!.lessons[0]!.locked).toBe(true);
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
