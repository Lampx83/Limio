import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse, duplicateCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createAssignment } from "../assignments";

/** LANG.8.7 — nhân bản khoá phải giữ chế độ ngoại ngữ, nhãn kỹ năng và rubric bài tập. */

const BASE = "http://localhost:3000";

async function setup(languageMode: boolean) {
  const r = await registerUser(
    { email: `dl${Date.now()}${Math.random()}@example.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(r.userId, { title: "Gốc", description: "x", languageMode });
  const m = await createModule(r.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(r.userId, m.moduleId, {
    title: "Viết",
    orderIndex: 0,
    ...(languageMode ? { languageSkill: "writing" } : {}),
  });
  await createAssignment(r.userId, l.lessonId, {
    title: "Bài viết",
    description: "mô tả",
    rubricText: "Tiêu chí: nội dung, từ vựng, ngữ pháp",
    responseFormat: "text",
    countsTowardGrade: false,
  });
  return { userId: r.userId, courseId: c.courseId };
}

describe("duplicateCourse với khoá ngoại ngữ", () => {
  it("giữ languageMode, languageSkill của bài và rubric của bài tập", async () => {
    const s = await setup(true);
    const { courseId } = await duplicateCourse(s.userId, s.courseId);
    const copy = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: { modules: { include: { lessons: { include: { assignments: true } } } } },
    });
    expect(copy.languageMode).toBe(true);
    expect(copy.personalizationEnabled).toBe(true);
    const lesson = copy.modules[0]!.lessons[0]!;
    expect(lesson.languageSkill).toBe("writing");
    expect(lesson.assignments[0]!.rubricText).toBe("Tiêu chí: nội dung, từ vựng, ngữ pháp");
    expect(lesson.assignments[0]!.countsTowardGrade).toBe(false);
  });

  it("khoá thường nhân bản vẫn không bật chế độ ngoại ngữ", async () => {
    const s = await setup(false);
    const { courseId } = await duplicateCourse(s.userId, s.courseId);
    const copy = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: { modules: { include: { lessons: true } } },
    });
    expect(copy.languageMode).toBe(false);
    expect(copy.modules[0]!.lessons[0]!.languageSkill).toBeNull();
  });
});
