import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  chooseBalancedTopic,
  createExam,
  createOralMaterialTopicList,
  createOralTopic,
  deleteOralTopic,
  listOralTopics,
  publishExam,
  startOralExamAttempt,
  updateOralTopic,
} from "../";

const BASE = "http://localhost:3000";

async function newOralExam(slug: string) {
  const owner = await registerUser(
    { email: `ot-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `ot-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin: 15,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
    attemptPolicy: "multi",
    maxAttempts: 3,
  });
  return { ownerId: owner.userId, courseId: course.courseId, examId };
}

async function newLearner(slug: string, courseId: string) {
  const l = await registerUser(
    { email: `ot-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(l.userId, courseId);
  return l.userId;
}

describe("chooseBalancedTopic (A6.7)", () => {
  it("returns null when there is nothing to choose from", () => {
    expect(chooseBalancedTopic([])).toBeNull();
  });

  it("picks the least-used topic", () => {
    expect(
      chooseBalancedTopic([
        { id: "a", used: 3 },
        { id: "b", used: 1 },
        { id: "c", used: 2 },
      ]),
    ).toBe("b");
  });

  it("breaks ties with the injected random source (deterministic in tests)", () => {
    const tied = [
      { id: "a", used: 1 },
      { id: "b", used: 1 },
      { id: "c", used: 1 },
      { id: "d", used: 5 },
    ];
    expect(chooseBalancedTopic(tied, () => 0)).toBe("a");
    expect(chooseBalancedTopic(tied, () => 0.99)).toBe("c");
    expect(chooseBalancedTopic(tied, () => 0.5)).toBe("b");
  });
});

describe("oral topics CRUD (A6.7)", () => {
  it("creates, lists in order, updates and deletes; emits events", async () => {
    const { ownerId, examId } = await newOralExam("c1");
    const a = await createOralTopic(ownerId, examId, { title: "  Đăng ký học phần ", brief: "Bối cảnh A" });
    const b = await createOralTopic(ownerId, examId, { title: "Điểm danh QR", brief: "Bối cảnh B" });

    let list = await listOralTopics(ownerId, examId);
    expect(list.map((t) => t.title)).toEqual(["Đăng ký học phần", "Điểm danh QR"]); // đã trim
    expect(list.every((t) => t.assignedCount === 0)).toBe(true);

    await updateOralTopic(ownerId, a.topicId, { title: "Đăng ký lớp", brief: "Bối cảnh A2" });
    await deleteOralTopic(ownerId, b.topicId);
    list = await listOralTopics(ownerId, examId);
    expect(list.map((t) => [t.title, t.brief])).toEqual([["Đăng ký lớp", "Bối cảnh A2"]]);

    const created = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralTopicCreated, userId: ownerId },
    });
    expect(created).not.toBeNull();
    const deleted = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralTopicDeleted, userId: ownerId },
    });
    expect(deleted).not.toBeNull();
  });

  it("rejects an empty title/brief with validation_failed", async () => {
    const { ownerId, examId } = await newOralExam("c2");
    await expect(createOralTopic(ownerId, examId, { title: "", brief: "x" })).rejects.toMatchObject({
      code: "validation_failed",
    });
    await expect(createOralTopic(ownerId, examId, { title: "x", brief: "  " })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("rejects topics on a written exam with exam_not_oral", async () => {
    const owner = await registerUser(
      { email: "ot-o-c3@e.com", password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, { title: "C3", description: "x", slug: "ot-course-c3" });
    const { examId } = await createExam(owner.userId, course.courseId, { title: "Viết", durationMin: 30 });
    await expect(createOralTopic(owner.userId, examId, { title: "x", brief: "y" })).rejects.toMatchObject({
      code: "exam_not_oral",
    });
  });

  it("locks topics once the exam is published (exam_not_draft)", async () => {
    const { ownerId, examId } = await newOralExam("c4");
    const t = await createOralTopic(ownerId, examId, { title: "T", brief: "B" });
    await createOralMaterialTopicList(ownerId, examId, { title: "M", text: "m" });
    await publishExam(ownerId, examId);
    await expect(createOralTopic(ownerId, examId, { title: "T2", brief: "B" })).rejects.toMatchObject({
      code: "exam_not_draft",
    });
    await expect(deleteOralTopic(ownerId, t.topicId)).rejects.toMatchObject({ code: "exam_not_draft" });
    await expect(updateOralTopic(ownerId, t.topicId, { title: "T3", brief: "B" })).rejects.toMatchObject({
      code: "exam_not_draft",
    });
  });

  it("throws topic_not_found for an unknown id", async () => {
    const { ownerId } = await newOralExam("c5");
    await expect(deleteOralTopic(ownerId, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({
      code: "topic_not_found",
    });
  });
});

describe("topic assignment when an attempt starts (A6.7)", () => {
  async function publishedWithTopics(slug: string, titles: string[]) {
    const s = await newOralExam(slug);
    for (const title of titles) await createOralTopic(s.ownerId, s.examId, { title, brief: `Bối cảnh ${title}` });
    await createOralMaterialTopicList(s.ownerId, s.examId, { title: "M", text: "m" });
    await publishExam(s.ownerId, s.examId);
    return s;
  }

  it("leaves oralTopicId null when the exam has no topics (behaviour unchanged)", async () => {
    const s = await newOralExam("a1");
    await createOralMaterialTopicList(s.ownerId, s.examId, { title: "M", text: "m" });
    await publishExam(s.ownerId, s.examId);
    const learner = await newLearner("a1", s.courseId);
    const r = await startOralExamAttempt(learner, s.examId);
    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    expect(attempt.oralTopicId).toBeNull();
  });

  it("spreads a class evenly across topics and records an event per assignment", async () => {
    const s = await publishedWithTopics("a2", ["A", "B", "C"]);
    const counts = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const learner = await newLearner(`a2-${i}`, s.courseId);
      const r = await startOralExamAttempt(learner, s.examId);
      const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
      expect(attempt.oralTopicId).not.toBeNull();
      counts.set(attempt.oralTopicId!, (counts.get(attempt.oralTopicId!) ?? 0) + 1);
    }
    expect([...counts.values()].sort()).toEqual([2, 2, 2]); // 6 sinh viên / 3 chủ đề

    const events = await prisma.learningEvent.count({
      where: { eventType: LearningEventType.ExamOralTopicAssigned },
    });
    expect(events).toBeGreaterThanOrEqual(6);

    const list = await listOralTopics(s.ownerId, s.examId);
    expect(list.map((t) => t.assignedCount)).toEqual([2, 2, 2]);
  });

  it("keeps the same topic when the learner resumes an in-progress attempt", async () => {
    const s = await publishedWithTopics("a3", ["A", "B"]);
    const learner = await newLearner("a3", s.courseId);
    const first = await startOralExamAttempt(learner, s.examId);
    const before = await prisma.examAttempt.findUniqueOrThrow({ where: { id: first.attemptId } });
    const again = await startOralExamAttempt(learner, s.examId);
    expect(again.resumed).toBe(true);
    const after = await prisma.examAttempt.findUniqueOrThrow({ where: { id: again.attemptId } });
    expect(after.oralTopicId).toBe(before.oralTopicId);
  });

  it("gives a retake a topic the learner has not had yet, while one is left", async () => {
    const s = await publishedWithTopics("a4", ["A", "B", "C"]);
    const learner = await newLearner("a4", s.courseId);
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await startOralExamAttempt(learner, s.examId, { retake: i > 0 });
      await prisma.examAttempt.update({ where: { id: r.attemptId }, data: { status: "submitted" } });
      const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
      seen.push(a.oralTopicId!);
    }
    expect(new Set(seen).size).toBe(3); // ba lượt, ba chủ đề khác nhau
  });

  it("nulls the attempt's topic (not the attempt) when a topic row is removed", async () => {
    const s = await newOralExam("a5");
    const t = await createOralTopic(s.ownerId, s.examId, { title: "A", brief: "b" });
    await createOralMaterialTopicList(s.ownerId, s.examId, { title: "M", text: "m" });
    await publishExam(s.ownerId, s.examId);
    const learner = await newLearner("a5", s.courseId);
    const r = await startOralExamAttempt(learner, s.examId);
    await prisma.oralExamTopic.delete({ where: { id: t.topicId } });
    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    expect(attempt.oralTopicId).toBeNull();
  });
});
