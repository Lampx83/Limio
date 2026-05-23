import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import {
  createExam,
  createPassage,
  createExamQuestion,
  deleteExamQuestion,
  ExamError,
  publishExam,
  reorderExamQuestions,
  updateExamQuestion,
} from "../";

const BASE = "http://localhost:3000";

async function newOwner(slug: string) {
  const u = await registerUser(
    { email: `qo-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(u.userId, {
    title: `Q course ${slug}`,
    description: "x",
    slug: `q-course-${slug}`,
  });
  return { ownerId: u.userId, courseId: c.courseId };
}

function validExam() {
  const now = Date.now();
  return {
    title: "Exam",
    durationMin: 60,
    openAt: new Date(now + 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
  };
}

const mcqConfig = () => ({
  options: [
    { id: "a", label: "Option A", isCorrect: true },
    { id: "b", label: "Option B", isCorrect: false },
    { id: "c", label: "Option C", isCorrect: false },
  ],
});

const multiConfig = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: true },
    { id: "c", label: "C", isCorrect: false },
  ],
});

describe("createExamQuestion (A7.3.1)", () => {
  it("creates MCQ bound to passage; appends orderInPassage", async () => {
    const { ownerId, courseId } = await newOwner("c1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const { passageId } = await createPassage(ownerId, examId, {
      title: "P",
      contentJson: { type: "doc", content: [] },
    });
    const a = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q1",
      config: mcqConfig(),
      passageId,
      points: 3,
    });
    const b = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q2",
      config: mcqConfig(),
      passageId,
    });
    const rows = await prisma.examQuestion.findMany({
      where: { passageId },
      orderBy: { orderInPassage: "asc" },
    });
    expect(rows.map((r) => r.id)).toEqual([a.questionId, b.questionId]);
    expect(rows[0]!.orderInPassage).toBe(0);
    expect(rows[1]!.orderInPassage).toBe(1);
    expect(rows[0]!.points).toBe(3);
  });

  it("rejects MCQ with 2+ correct options", async () => {
    const { ownerId, courseId } = await newOwner("c2");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await expect(
      createExamQuestion(ownerId, examId, {
        type: "mcq",
        prompt: "Q",
        config: {
          options: [
            { id: "a", label: "A", isCorrect: true },
            { id: "b", label: "B", isCorrect: true },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("accepts MULTI with 2+ correct", async () => {
    const { ownerId, courseId } = await newOwner("c3");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const r = await createExamQuestion(ownerId, examId, {
      type: "multi",
      prompt: "Pick all",
      config: multiConfig(),
    });
    const q = await prisma.examQuestion.findUniqueOrThrow({ where: { id: r.questionId } });
    expect(q.type).toBe("multi");
  });

  it("validates TRUE_FALSE_NOTGIVEN correct enum", async () => {
    const { ownerId, courseId } = await newOwner("c4");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await createExamQuestion(ownerId, examId, {
      type: "true_false_notgiven",
      prompt: "T/F/NG",
      config: { correct: "notgiven" },
    });
    await expect(
      createExamQuestion(ownerId, examId, {
        type: "true_false_notgiven",
        prompt: "Bad",
        config: { correct: "yes" },
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("validates GAP_FILL blanks shape", async () => {
    const { ownerId, courseId } = await newOwner("c5");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await createExamQuestion(ownerId, examId, {
      type: "gap_fill",
      prompt: "Fill ___",
      config: {
        blanks: [
          { id: "b1", acceptedAnswers: ["paris", "Paris"], matchMode: "case_insensitive" },
        ],
      },
    });
    await expect(
      createExamQuestion(ownerId, examId, {
        type: "gap_fill",
        prompt: "Bad",
        config: { blanks: [] },
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("validates SHORT_ANSWER acceptedAnswers required", async () => {
    const { ownerId, courseId } = await newOwner("c6");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await expect(
      createExamQuestion(ownerId, examId, {
        type: "short_answer",
        prompt: "Capital of France?",
        config: { acceptedAnswers: [] },
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("accepts ESSAY with optional rubric", async () => {
    const { ownerId, courseId } = await newOwner("c7");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const r = await createExamQuestion(ownerId, examId, {
      type: "essay",
      prompt: "Discuss",
      config: { rubric: "Coherence + evidence", minWords: 100 },
    });
    expect(r.questionId).toBeDefined();
  });

  it("A7.3.2 — standalone question (passageId=null)", async () => {
    const { ownerId, courseId } = await newOwner("c8");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const r = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Standalone",
      config: mcqConfig(),
      passageId: null,
    });
    const q = await prisma.examQuestion.findUniqueOrThrow({ where: { id: r.questionId } });
    expect(q.passageId).toBeNull();
    expect(q.orderInPassage).toBeNull();
  });

  it("A7.3.3 — saves without skillTags and publishExam succeeds (skill-tag requirement removed)", async () => {
    const { ownerId, courseId } = await newOwner("c9");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "No skill",
      config: mcqConfig(),
    });
    await publishExam(ownerId, examId);
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(exam.status).toBe("published");
  });

  it("rejects matching_heading in P0", async () => {
    const { ownerId, courseId } = await newOwner("ca");
    const { examId } = await createExam(ownerId, courseId, validExam());
    await expect(
      createExamQuestion(ownerId, examId, {
        type: "matching_heading",
        prompt: "Match",
        config: {},
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("rejects passage from another exam", async () => {
    const { ownerId, courseId } = await newOwner("cb");
    const a = await createExam(ownerId, courseId, validExam());
    const b = await createExam(ownerId, courseId, validExam());
    const otherPassage = await createPassage(ownerId, b.examId, {
      title: "P",
      contentJson: { type: "doc", content: [] },
    });
    await expect(
      createExamQuestion(ownerId, a.examId, {
        type: "mcq",
        prompt: "Q",
        config: mcqConfig(),
        passageId: otherPassage.passageId,
      }),
    ).rejects.toMatchObject({ code: "course_mismatch" });
  });
});

describe("updateExamQuestion", () => {
  it("updates prompt + config; revalidates config when type changes", async () => {
    const { ownerId, courseId } = await newOwner("u1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const r = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q",
      config: mcqConfig(),
    });
    // Switch to true_false_notgiven with new valid config
    await updateExamQuestion(ownerId, r.questionId, {
      type: "true_false_notgiven",
      config: { correct: "true" },
    });
    const q = await prisma.examQuestion.findUniqueOrThrow({ where: { id: r.questionId } });
    expect(q.type).toBe("true_false_notgiven");
  });

  it("rejects type switch when stored config doesn't match new type", async () => {
    const { ownerId, courseId } = await newOwner("u2");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const r = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q",
      config: mcqConfig(),
    });
    await expect(
      updateExamQuestion(ownerId, r.questionId, { type: "true_false_notgiven" }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("replaces skillTags", async () => {
    const { ownerId, courseId } = await newOwner("u3");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const s1 = await prisma.skill.create({ data: { code: "u3.a", name: "A" } });
    const s2 = await prisma.skill.create({ data: { code: "u3.b", name: "B" } });
    const r = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q",
      config: mcqConfig(),
      skillIds: [s1.id],
    });
    await updateExamQuestion(ownerId, r.questionId, { skillIds: [s2.id] });
    const tags = await prisma.examQuestionSkillTag.findMany({
      where: { questionId: r.questionId },
    });
    expect(tags.map((t) => t.skillId)).toEqual([s2.id]);
  });

  it("moves question between passages", async () => {
    const { ownerId, courseId } = await newOwner("u4");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const pA = await createPassage(ownerId, examId, {
      title: "A",
      contentJson: { type: "doc", content: [] },
    });
    const pB = await createPassage(ownerId, examId, {
      title: "B",
      contentJson: { type: "doc", content: [] },
    });
    const r = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q",
      config: mcqConfig(),
      passageId: pA.passageId,
    });
    await updateExamQuestion(ownerId, r.questionId, { passageId: pB.passageId });
    const q = await prisma.examQuestion.findUniqueOrThrow({ where: { id: r.questionId } });
    expect(q.passageId).toBe(pB.passageId);
    expect(q.orderInPassage).toBe(0);
  });
});

describe("reorderExamQuestions", () => {
  it("reorders within a passage by orderInPassage", async () => {
    const { ownerId, courseId } = await newOwner("r1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const { passageId } = await createPassage(ownerId, examId, {
      title: "P",
      contentJson: { type: "doc", content: [] },
    });
    const a = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q1",
      config: mcqConfig(),
      passageId,
    });
    const b = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q2",
      config: mcqConfig(),
      passageId,
    });
    const c = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q3",
      config: mcqConfig(),
      passageId,
    });
    await reorderExamQuestions(ownerId, examId, passageId, [
      c.questionId,
      a.questionId,
      b.questionId,
    ]);
    const rows = await prisma.examQuestion.findMany({
      where: { passageId },
      orderBy: { orderInPassage: "asc" },
    });
    expect(rows.map((r) => r.id)).toEqual([c.questionId, a.questionId, b.questionId]);
  });

  it("reorders standalone questions by orderInExam", async () => {
    const { ownerId, courseId } = await newOwner("r2");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const a = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q1",
      config: mcqConfig(),
      passageId: null,
    });
    const b = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q2",
      config: mcqConfig(),
      passageId: null,
    });
    await reorderExamQuestions(ownerId, examId, null, [b.questionId, a.questionId]);
    const rows = await prisma.examQuestion.findMany({
      where: { examId, passageId: null },
      orderBy: { orderInExam: "asc" },
    });
    expect(rows.map((r) => r.id)).toEqual([b.questionId, a.questionId]);
  });
});

describe("deleteExamQuestion", () => {
  it("hard-deletes question on draft exam", async () => {
    const { ownerId, courseId } = await newOwner("d1");
    const { examId } = await createExam(ownerId, courseId, validExam());
    const r = await createExamQuestion(ownerId, examId, {
      type: "mcq",
      prompt: "Q",
      config: mcqConfig(),
    });
    await deleteExamQuestion(ownerId, r.questionId);
    expect(
      await prisma.examQuestion.findUnique({ where: { id: r.questionId } }),
    ).toBeNull();
  });
});
