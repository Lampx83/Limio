import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { registerUser } from "../../auth/register";
import { createQuiz, deleteQuiz, updateQuiz, QuizError } from "../";
import { createQuestion } from "../questions";
import { CourseAuthzError } from "../../courses/authz";

const BASE = "http://localhost:3000";

async function newOwner(slug: string) {
  const u = await registerUser(
    { email: `o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(u.userId, { title: slug, description: "x", slug });
  const m = await createModule(u.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(u.userId, m.moduleId, { title: "L", orderIndex: 0 });
  return { ownerId: u.userId, courseId: c.courseId, lessonId: l.lessonId };
}

describe("createQuiz", () => {
  it("AC-A4.1: creates quiz scoped to course; defaults applied", async () => {
    const { ownerId, courseId } = await newOwner("q1");
    const r = await createQuiz(ownerId, { courseId }, { title: "Quiz 1" });
    const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: r.quizId } });
    expect(quiz.courseId).toBe(courseId);
    expect(quiz.lessonId).toBeNull();
    expect(quiz.requireConfidence).toBe(true);
  });

  it("creates quiz scoped to lesson", async () => {
    const { ownerId, courseId, lessonId } = await newOwner("q2");
    const r = await createQuiz(ownerId, { courseId, lessonId }, { title: "Quiz 2" });
    const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: r.quizId } });
    expect(quiz.lessonId).toBe(lessonId);
  });

  it("rejects lesson that doesn't belong to course", async () => {
    const a = await newOwner("q3a");
    const b = await newOwner("q3b");
    await expect(
      createQuiz(a.ownerId, { courseId: a.courseId, lessonId: b.lessonId }, { title: "X" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("non-owner / non-admin → forbidden", async () => {
    const { courseId } = await newOwner("q4");
    const outsider = await registerUser(
      { email: "out-q4@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      createQuiz(outsider.userId, { courseId }, { title: "X" }),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("updateQuiz / deleteQuiz", () => {
  it("update changes fields", async () => {
    const { ownerId, courseId } = await newOwner("q5");
    const r = await createQuiz(ownerId, { courseId }, { title: "X" });
    await updateQuiz(ownerId, r.quizId, { title: "Y", difficulty: 3 });
    const q = await prisma.quiz.findUniqueOrThrow({ where: { id: r.quizId } });
    expect(q.title).toBe("Y");
    expect(q.difficulty).toBe(3);
  });

  it("delete removes quiz + cascade questions", async () => {
    const { ownerId, courseId } = await newOwner("q6");
    const r = await createQuiz(ownerId, { courseId }, { title: "X" });
    await createQuestion(ownerId, r.quizId, {
      type: "true_false",
      prompt: "p",
      orderIndex: 0,
      options: [
        { label: "T", isCorrect: true },
        { label: "F", isCorrect: false },
      ],
    });
    await deleteQuiz(ownerId, r.quizId);
    expect(await prisma.quiz.findUnique({ where: { id: r.quizId } })).toBeNull();
    expect(await prisma.quizQuestion.count({ where: { quizId: r.quizId } })).toBe(0);
  });

  it("delete on unknown quiz throws quiz_not_found", async () => {
    const { ownerId } = await newOwner("q7");
    await expect(
      deleteQuiz(ownerId, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toBeInstanceOf(QuizError);
  });
});
