import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";
import { createQuiz } from "../quizzes";
import { createQuestion, tagQuestionSkill, untagQuestionSkill } from "../questions";

const BASE = "http://localhost:3000";

async function setup(slugLabel: string) {
  const slug = slugLabel.toLowerCase();
  const u = await registerUser(
    { email: `q-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(u.userId, { title: slug, description: "x", slug });
  const q = await createQuiz(u.userId, { courseId: c.courseId }, { title: "Q" });
  return { ownerId: u.userId, courseId: c.courseId, quizId: q.quizId };
}

describe("createQuestion", () => {
  it("AC-A4.2: creates MCQ with options + skill tags in one tx", async () => {
    const { ownerId, quizId } = await setup("Q1");
    const skill = await createSkill({ code: "skill.q1", name: "S1" });
    const q = await createQuestion(ownerId, quizId, {
      type: "mcq",
      prompt: "Pick A",
      orderIndex: 0,
      options: [
        { label: "A", isCorrect: true },
        { label: "B", isCorrect: false },
        { label: "C", isCorrect: false },
      ],
      skillIds: [skill.skillId],
    });
    const opts = await prisma.questionOption.findMany({ where: { questionId: q.questionId } });
    expect(opts).toHaveLength(3);
    expect(opts.filter((o) => o.isCorrect)).toHaveLength(1);
    const tags = await prisma.questionSkillTag.findMany({ where: { questionId: q.questionId } });
    expect(tags.map((t) => t.skillId)).toEqual([skill.skillId]);
  });

  it("bỏ trống orderIndex thì nối vào cuối, kể cả sau câu có chỉ số lớn hoặc chỉ số tường minh", async () => {
    const { ownerId, quizId } = await setup("Q-append");
    const opts = [
      { label: "A", isCorrect: true },
      { label: "B", isCorrect: false },
    ];
    const add = (prompt: string, orderIndex?: number) =>
      createQuestion(ownerId, quizId, { type: "mcq", prompt, options: opts, ...(orderIndex === undefined ? {} : { orderIndex }) });
    await add("first");
    await add("big", 73512);
    await add("after-big");
    await add("last");
    const rows = await prisma.quizQuestion.findMany({ where: { quizId }, orderBy: { orderIndex: "asc" } });
    expect(rows.map((r) => r.prompt)).toEqual(["first", "big", "after-big", "last"]);
    expect(new Set(rows.map((r) => r.orderIndex)).size).toBe(4);
  });

  it("rejects question with zero correct options", async () => {
    const { ownerId, quizId } = await setup("Q2");
    await expect(
      createQuestion(ownerId, quizId, {
        type: "mcq",
        prompt: "p",
        orderIndex: 0,
        options: [
          { label: "A", isCorrect: false },
          { label: "B", isCorrect: false },
        ],
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("rejects true_false with !=2 options or !=1 correct", async () => {
    const { ownerId, quizId } = await setup("Q3");
    await expect(
      createQuestion(ownerId, quizId, {
        type: "true_false",
        prompt: "p",
        orderIndex: 0,
        options: [
          { label: "T", isCorrect: true },
          { label: "F", isCorrect: true }, // 2 correct → invalid
        ],
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });

    await expect(
      createQuestion(ownerId, quizId, {
        type: "true_false",
        prompt: "p",
        orderIndex: 1,
        options: [
          { label: "T", isCorrect: true },
          { label: "F", isCorrect: false },
          { label: "Maybe", isCorrect: false }, // 3 options → invalid
        ],
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("AC-A4.3: option misconceptionId persisted", async () => {
    const { ownerId, quizId } = await setup("Q4");
    const m = await prisma.misconception.create({
      data: { code: "wrong_x_q4", name: "X", description: "x" },
    });
    const q = await createQuestion(ownerId, quizId, {
      type: "mcq",
      prompt: "p",
      orderIndex: 0,
      options: [
        { label: "right", isCorrect: true },
        { label: "wrong", isCorrect: false, misconceptionId: m.id },
      ],
    });
    const opts = await prisma.questionOption.findMany({ where: { questionId: q.questionId } });
    const wrong = opts.find((o) => !o.isCorrect)!;
    expect(wrong.misconceptionId).toBe(m.id);
  });
});

describe("question skill tagging", () => {
  it("AC-A4.14: tag + untag works, idempotent", async () => {
    const { ownerId, quizId } = await setup("Q5");
    const skill = await createSkill({ code: "skill.q5", name: "S" });
    const q = await createQuestion(ownerId, quizId, {
      type: "true_false",
      prompt: "p",
      orderIndex: 0,
      options: [
        { label: "T", isCorrect: true },
        { label: "F", isCorrect: false },
      ],
    });
    const r1 = await tagQuestionSkill(ownerId, q.questionId, skill.skillId);
    expect(r1.created).toBe(true);
    const r2 = await tagQuestionSkill(ownerId, q.questionId, skill.skillId);
    expect(r2.created).toBe(false);
    await untagQuestionSkill(ownerId, q.questionId, skill.skillId);
    const tags = await prisma.questionSkillTag.findMany({ where: { questionId: q.questionId } });
    expect(tags).toHaveLength(0);
  });
});
