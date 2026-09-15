import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { CourseAuthzError } from "../../courses/authz";
import {
  createExam,
  createOralMaterialTopicList,
  deleteExam,
  ExamError,
  getExam,
  listExamsForCourse,
  publishExam,
  updateExam,
} from "../";

const BASE = "http://localhost:3000";

async function newOwner(slug: string) {
  const u = await registerUser(
    { email: `eo-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(u.userId, {
    title: `Exam course ${slug}`,
    description: "x",
    slug: `exam-course-${slug}`,
  });
  return { ownerId: u.userId, courseId: c.courseId };
}

async function newOutsider(slug: string) {
  const u = await registerUser(
    { email: `eu-${slug}@e.com`, password: "password1234", displayName: "U" },
    BASE,
  );
  return u.userId;
}

function validExamInput(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  return {
    title: "Final Exam",
    durationMin: 60,
    openAt: new Date(now + 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    ...overrides,
  };
}

describe("createExam (A7.1.1)", () => {
  it("creates exam in draft status with defaults", async () => {
    const { ownerId, courseId } = await newOwner("c1");
    const r = await createExam(ownerId, courseId, validExamInput());
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: r.examId } });
    expect(exam.courseId).toBe(courseId);
    expect(exam.status).toBe("draft");
    expect(exam.attemptPolicy).toBe("single");
    expect(exam.gradingMode).toBe("hybrid");
    expect(exam.shuffleQuestions).toBe(true);
  });

  it("A6.3/A6.4 — creates an oral exam with language, examinerInstructions and oralRubricText", async () => {
    const { ownerId, courseId } = await newOwner("c1b");
    const r = await createExam(
      ownerId,
      courseId,
      validExamInput({
        kind: "oral",
        language: "en",
        examinerInstructions: "Không để sinh viên dẫn dắt.",
        oralRubricText: "3đ khái niệm, 7đ ví dụ.",
      }),
    );
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: r.examId } });
    expect(exam.language).toBe("en");
    expect(exam.examinerInstructions).toBe("Không để sinh viên dẫn dắt.");
    expect(exam.oralRubricText).toBe("3đ khái niệm, 7đ ví dụ.");
  });

  it("defaults language to vi when omitted", async () => {
    const { ownerId, courseId } = await newOwner("c1c");
    const r = await createExam(ownerId, courseId, validExamInput({ kind: "oral" }));
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: r.examId } });
    expect(exam.language).toBe("vi");
  });

  it("emits exam.created event", async () => {
    const { ownerId, courseId } = await newOwner("c2");
    const r = await createExam(ownerId, courseId, validExamInput());
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamCreated, userId: ownerId },
    });
    expect(ev).not.toBeNull();
    expect((ev!.payload as Record<string, unknown>).examId).toBe(r.examId);
  });

  it("rejects when openAt >= closeAt", async () => {
    const { ownerId, courseId } = await newOwner("c3");
    const now = Date.now();
    await expect(
      createExam(ownerId, courseId, {
        title: "X",
        durationMin: 60,
        openAt: new Date(now + 1000),
        closeAt: new Date(now),
      }),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("rejects negative durationMin", async () => {
    const { ownerId, courseId } = await newOwner("c4");
    await expect(
      createExam(ownerId, courseId, validExamInput({ durationMin: 0 })),
    ).rejects.toBeInstanceOf(ExamError);
  });

  it("A7.1.4 — outsider cannot create exam in another's course", async () => {
    const { courseId } = await newOwner("c5");
    const outsider = await newOutsider("c5");
    await expect(
      createExam(outsider, courseId, validExamInput()),
    ).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("publishExam (A7.1.2)", () => {
  it("rejects when no passages and no questions", async () => {
    const { ownerId, courseId } = await newOwner("p1");
    const { examId } = await createExam(ownerId, courseId, validExamInput());
    await expect(publishExam(ownerId, examId)).rejects.toMatchObject({
      code: "exam_not_publishable",
    });
  });

  it("publishes when question has no skill tag (skill-tag requirement removed)", async () => {
    const { ownerId, courseId } = await newOwner("p2");
    const { examId } = await createExam(ownerId, courseId, validExamInput());
    await prisma.examQuestion.create({
      data: {
        examId,
        type: "mcq",
        prompt: "1+1?",
        config: { options: [{ id: "a", label: "2", isCorrect: true }, { id: "b", label: "3", isCorrect: false }] },
        points: 5,
        orderInExam: 0,
      },
    });
    await publishExam(ownerId, examId);
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(exam.status).toBe("published");
  });

  it("publishes when validation passes; emits exam.published", async () => {
    const { ownerId, courseId } = await newOwner("p3");
    const { examId } = await createExam(ownerId, courseId, validExamInput());
    const skill = await prisma.skill.create({
      data: { code: "exam.test.skill.p3", name: "Test skill" },
    });
    const q = await prisma.examQuestion.create({
      data: {
        examId,
        type: "mcq",
        prompt: "1+1?",
        config: { options: [{ id: "a", label: "2", isCorrect: true }, { id: "b", label: "3", isCorrect: false }] },
        points: 5,
        orderInExam: 0,
      },
    });
    await prisma.examQuestionSkillTag.create({
      data: { questionId: q.id, skillId: skill.id },
    });
    await publishExam(ownerId, examId);
    const fresh = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(fresh.status).toBe("published");
    expect(fresh.publishedAt).not.toBeNull();
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamPublished },
    });
    expect(ev).not.toBeNull();
    expect((ev!.payload as Record<string, unknown>).totalPoints).toBe(5);
  });

  it("refuses to publish a non-draft exam", async () => {
    const { ownerId, courseId } = await newOwner("p4");
    const { examId } = await createExam(ownerId, courseId, validExamInput());
    const skill = await prisma.skill.create({
      data: { code: "exam.test.skill.p4", name: "S" },
    });
    const q = await prisma.examQuestion.create({
      data: {
        examId,
        type: "mcq",
        prompt: "Q",
        config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
        points: 1,
        orderInExam: 0,
      },
    });
    await prisma.examQuestionSkillTag.create({
      data: { questionId: q.id, skillId: skill.id },
    });
    await publishExam(ownerId, examId);
    await expect(publishExam(ownerId, examId)).rejects.toMatchObject({
      code: "exam_not_draft",
    });
  });
});

describe("updateExam (A7.1.3)", () => {
  it("allows full edit while in draft", async () => {
    const { ownerId, courseId } = await newOwner("u1");
    const { examId } = await createExam(ownerId, courseId, validExamInput());
    await updateExam(ownerId, examId, { title: "Renamed", durationMin: 90 });
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(e.title).toBe("Renamed");
    expect(e.durationMin).toBe(90);
  });

  it("rejects forbidden fields once published exam has attempts", async () => {
    const { ownerId, courseId } = await newOwner("u2");
    const { examId } = await createExam(ownerId, courseId, validExamInput());
    const skill = await prisma.skill.create({
      data: { code: "exam.test.skill.u2", name: "S" },
    });
    const q = await prisma.examQuestion.create({
      data: {
        examId,
        type: "mcq",
        prompt: "Q",
        config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
        points: 1,
        orderInExam: 0,
      },
    });
    await prisma.examQuestionSkillTag.create({
      data: { questionId: q.id, skillId: skill.id },
    });
    await publishExam(ownerId, examId);
    // Simulate a learner attempt.
    const learner = await newOutsider("u2");
    await prisma.examAttempt.create({
      data: { examId, userId: learner, durationSec: 3600 },
    });
    // closeAt extension allowed
    const newClose = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    await updateExam(ownerId, examId, { closeAt: newClose });
    // durationMin change blocked
    await expect(
      updateExam(ownerId, examId, { durationMin: 30 }),
    ).rejects.toMatchObject({ code: "exam_has_attempts" });
  });

  it("A6.4 — allows editing oralRubricText even after publish/attempts (không ảnh hưởng câu hỏi SV nhận)", async () => {
    const { ownerId, courseId } = await newOwner("u3");
    const { examId } = await createExam(ownerId, courseId, validExamInput({ kind: "oral" }));
    await createOralMaterialTopicList(ownerId, examId, { title: "Chủ đề", text: "x" });
    await publishExam(ownerId, examId);
    const learner = await newOutsider("u3");
    await prisma.examAttempt.create({
      data: { examId, userId: learner, durationSec: 3600 },
    });
    await updateExam(ownerId, examId, { oralRubricText: "Rubric sửa sau khi thi." });
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(e.oralRubricText).toBe("Rubric sửa sau khi thi.");
  });
});

describe("listExamsForCourse + getExam", () => {
  it("lists only exams in course; getExam returns full shape", async () => {
    const { ownerId, courseId } = await newOwner("g1");
    const a = await createExam(ownerId, courseId, validExamInput({ title: "A" }));
    await createExam(ownerId, courseId, validExamInput({ title: "B" }));
    const list = await listExamsForCourse(ownerId, courseId);
    expect(list).toHaveLength(2);
    const full = await getExam(ownerId, a.examId);
    expect(full.id).toBe(a.examId);
    expect(full.passages).toEqual([]);
    expect(full.questions).toEqual([]);
  });
});

describe("deleteExam", () => {
  it("deletes draft exam", async () => {
    const { ownerId, courseId } = await newOwner("d1");
    const { examId } = await createExam(ownerId, courseId, validExamInput());
    await deleteExam(ownerId, examId);
    expect(await prisma.exam.findUnique({ where: { id: examId } })).toBeNull();
  });

  it("refuses to delete published exam with attempts", async () => {
    const { ownerId, courseId } = await newOwner("d2");
    const { examId } = await createExam(ownerId, courseId, validExamInput());
    const skill = await prisma.skill.create({
      data: { code: "exam.test.skill.d2", name: "S" },
    });
    const q = await prisma.examQuestion.create({
      data: {
        examId,
        type: "mcq",
        prompt: "Q",
        config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
        points: 1,
        orderInExam: 0,
      },
    });
    await prisma.examQuestionSkillTag.create({
      data: { questionId: q.id, skillId: skill.id },
    });
    await publishExam(ownerId, examId);
    const learner = await newOutsider("d2");
    await prisma.examAttempt.create({
      data: { examId, userId: learner, durationSec: 3600 },
    });
    await expect(deleteExam(ownerId, examId)).rejects.toMatchObject({
      code: "exam_has_attempts",
    });
  });
});
