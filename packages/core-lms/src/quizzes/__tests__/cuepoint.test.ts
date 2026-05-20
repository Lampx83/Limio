import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill } from "../../courses/skills";
import { createContentItem } from "../../courses/contents";
import {
  createCuepointQuiz,
  updateCuepointQuiz,
  deleteCuepointQuizIfOrphan,
} from "../cuepoint";

const BASE = "http://localhost:3000";

async function setup(slugLabel: string) {
  const slug = slugLabel.toLowerCase();
  const u = await registerUser(
    { email: `cue-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(u.userId, { title: slug, description: "x", slug });
  const m = await createModule(u.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(u.userId, m.moduleId, { title: "L", orderIndex: 0 });
  const skill = await createSkill({ code: `skill.${slug}`, name: "S" });
  return {
    ownerId: u.userId,
    courseId: c.courseId,
    lessonId: l.lessonId,
    skillId: skill.skillId,
  };
}

function mcq(skillId: string, prompt = "Pick A") {
  return {
    type: "mcq" as const,
    prompt,
    points: 1,
    options: [
      { label: "A", isCorrect: true },
      { label: "B", isCorrect: false },
      { label: "C", isCorrect: false },
    ],
    skillIds: [skillId],
  };
}

describe("createCuepointQuiz", () => {
  it("creates hidden cuepointOnly quiz with 1 question + skill tag (AC2)", async () => {
    const { ownerId, lessonId, skillId } = await setup("C1");
    const r = await createCuepointQuiz(ownerId, lessonId, {
      atSec: 90,
      question: mcq(skillId),
    });

    const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: r.quizId } });
    expect(quiz.cuepointOnly).toBe(true);
    expect(quiz.isHidden).toBe(true);
    expect(quiz.passThresholdPct).toBe(100);
    expect(quiz.title).toBe("Cuepoint @ 01:30");
    expect(quiz.lessonId).toBe(lessonId);

    const questions = await prisma.quizQuestion.findMany({
      where: { quizId: r.quizId },
      include: { options: true, skillTags: true },
    });
    expect(questions).toHaveLength(1);
    expect(questions[0]!.options).toHaveLength(3);
    expect(questions[0]!.options.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(questions[0]!.skillTags.map((t) => t.skillId)).toEqual([skillId]);
  });

  it("rejects question without skill tag (AC7)", async () => {
    const { ownerId, lessonId } = await setup("C2");
    await expect(
      createCuepointQuiz(ownerId, lessonId, {
        atSec: 10,
        question: { ...mcq("dummy"), skillIds: [] },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("rejects question with no correct option", async () => {
    const { ownerId, lessonId, skillId } = await setup("C3");
    await expect(
      createCuepointQuiz(ownerId, lessonId, {
        atSec: 10,
        question: {
          type: "mcq",
          prompt: "p",
          options: [
            { label: "A", isCorrect: false },
            { label: "B", isCorrect: false },
          ],
          skillIds: [skillId],
        },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("rejects atSec < 0 and empty prompt", async () => {
    const { ownerId, lessonId, skillId } = await setup("C4");
    await expect(
      createCuepointQuiz(ownerId, lessonId, { atSec: -1, question: mcq(skillId) }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      createCuepointQuiz(ownerId, lessonId, {
        atSec: 0,
        question: { ...mcq(skillId), prompt: "" },
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("rejects non-owner", async () => {
    const { lessonId, skillId } = await setup("C5");
    const other = await registerUser(
      { email: "other-c5@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      createCuepointQuiz(other.userId, lessonId, { atSec: 0, question: mcq(skillId) }),
    ).rejects.toBeTruthy();
  });
});

describe("updateCuepointQuiz", () => {
  it("updates prompt + options + skill tags + title (AC4)", async () => {
    const { ownerId, lessonId, skillId } = await setup("U1");
    const skill2 = await createSkill({ code: "skill.u1b", name: "S2" });
    const r = await createCuepointQuiz(ownerId, lessonId, {
      atSec: 30,
      question: mcq(skillId, "Old"),
    });

    await updateCuepointQuiz(ownerId, r.quizId, {
      atSec: 125,
      question: {
        prompt: "New prompt",
        options: [
          { label: "X", isCorrect: true },
          { label: "Y", isCorrect: false },
        ],
        skillIds: [skill2.skillId],
      },
    });

    const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: r.quizId } });
    expect(quiz.title).toBe("Cuepoint @ 02:05");
    const q = await prisma.quizQuestion.findFirstOrThrow({
      where: { quizId: r.quizId },
      include: { options: true, skillTags: true },
    });
    expect(q.prompt).toBe("New prompt");
    expect(q.options.map((o) => o.label).sort()).toEqual(["X", "Y"]);
    expect(q.skillTags.map((t) => t.skillId)).toEqual([skill2.skillId]);
  });

  it("rejects updating a non-cuepoint quiz", async () => {
    const { ownerId, lessonId, skillId } = await setup("U2");
    // Create regular quiz via prisma directly.
    const regular = await prisma.quiz.create({
      data: { courseId: (await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } })).module.courseId, lessonId, title: "Reg" },
    });
    await expect(
      updateCuepointQuiz(ownerId, regular.id, { question: { prompt: "x", skillIds: [skillId] } }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("deleteCuepointQuizIfOrphan", () => {
  it("deletes when no ContentItem references it (AC5)", async () => {
    const { ownerId, lessonId, skillId } = await setup("D1");
    const r = await createCuepointQuiz(ownerId, lessonId, {
      atSec: 30,
      question: mcq(skillId),
    });
    const ok = await deleteCuepointQuizIfOrphan(ownerId, r.quizId);
    expect(ok).toBe(true);
    expect(await prisma.quiz.findUnique({ where: { id: r.quizId } })).toBeNull();
  });

  it("keeps quiz when a video ContentItem still references it (AC5 negative)", async () => {
    const { ownerId, lessonId, skillId } = await setup("D2");
    const r = await createCuepointQuiz(ownerId, lessonId, {
      atSec: 30,
      question: mcq(skillId),
    });
    await createContentItem(ownerId, lessonId, {
      type: "video",
      orderIndex: 0,
      payload: {
        url: "https://example.com/v.mp4",
        cuepoints: [{ atSec: 30, quizId: r.quizId }],
      },
    });
    const ok = await deleteCuepointQuizIfOrphan(ownerId, r.quizId);
    expect(ok).toBe(false);
    expect(await prisma.quiz.findUnique({ where: { id: r.quizId } })).not.toBeNull();
  });

  it("returns false for non-cuepoint quiz (safety)", async () => {
    const { ownerId, lessonId } = await setup("D3");
    const courseId = (await prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { module: { select: { courseId: true } } },
    })).module.courseId;
    const regular = await prisma.quiz.create({
      data: { courseId, lessonId, title: "Reg" },
    });
    const ok = await deleteCuepointQuizIfOrphan(ownerId, regular.id);
    expect(ok).toBe(false);
    expect(await prisma.quiz.findUnique({ where: { id: regular.id } })).not.toBeNull();
  });
});
