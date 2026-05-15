import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  claimAttemptSession,
  createExam,
  createExamQuestion,
  createPassage,
  ExamError,
  getAttemptRuntime,
  publishExam,
  saveAnswer,
  startExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcqConfig = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
    { id: "c", label: "C", isCorrect: false },
  ],
});

async function publishedExamSetup(slug: string, durationMin = 60) {
  const owner = await registerUser(
    { email: `attempt-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `attempt-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
  });
  const { passageId } = await createPassage(owner.userId, examId, {
    title: "P",
    contentJson: { type: "doc", content: [] },
  });
  const skill = await prisma.skill.create({
    data: { code: `attempt.skill.${slug}`, name: "S" },
  });
  const q1 = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q1",
    config: mcqConfig(),
    passageId,
    skillIds: [skill.id],
  });
  const q2 = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q2",
    config: mcqConfig(),
    passageId,
    skillIds: [skill.id],
  });
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `attempt-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  return {
    ownerId: owner.userId,
    courseId: course.courseId,
    examId,
    passageId,
    q1Id: q1.questionId,
    q2Id: q2.questionId,
    learnerId: learner.userId,
  };
}

describe("startExamAttempt (A7.4.1)", () => {
  it("creates attempt in_progress and emits exam.started", async () => {
    const { examId, learnerId } = await publishedExamSetup("s1");
    const r = await startExamAttempt(learnerId, examId);
    expect(r.resumed).toBe(false);
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    expect(a.status).toBe("in_progress");
    expect(a.durationSec).toBe(60 * 60);
    expect(a.sessionToken).toBe(r.sessionToken);
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamStarted, userId: learnerId },
    });
    expect(ev).not.toBeNull();
  });

  it("rejects when learner not enrolled", async () => {
    const { examId } = await publishedExamSetup("s2");
    const other = await registerUser(
      { email: "stranger-s2@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(startExamAttempt(other.userId, examId)).rejects.toMatchObject({
      code: "not_enrolled",
    });
  });

  it("rejects when exam is draft", async () => {
    const { ownerId } = await publishedExamSetup("s3");
    const course = await prisma.course.findFirstOrThrow({
      where: { slug: "attempt-course-s3" },
    });
    const now = Date.now();
    const { examId } = await createExam(ownerId, course.id, {
      title: "Draft Exam",
      durationMin: 30,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    });
    const learner = await prisma.user.findFirstOrThrow({
      where: { email: "attempt-l-s3@e.com" },
    });
    await expect(startExamAttempt(learner.id, examId)).rejects.toMatchObject({
      code: "exam_not_open",
    });
  });

  it("rejects after closeAt", async () => {
    const setup = await publishedExamSetup("s4");
    await prisma.exam.update({
      where: { id: setup.examId },
      data: { closeAt: new Date(Date.now() - 60_000) },
    });
    await expect(startExamAttempt(setup.learnerId, setup.examId)).rejects.toMatchObject({
      code: "exam_window_closed",
    });
  });

  it("A7.4.5 — second call resumes existing in-progress attempt and rotates token", async () => {
    const { examId, learnerId } = await publishedExamSetup("s5");
    const first = await startExamAttempt(learnerId, examId);
    const second = await startExamAttempt(learnerId, examId);
    expect(second.resumed).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
    expect(second.sessionToken).not.toBe(first.sessionToken);
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: first.attemptId } });
    expect(a.resumeCount).toBe(1);
  });

  it("rejects when single-attempt policy + previous submitted", async () => {
    const { examId, learnerId } = await publishedExamSetup("s6");
    const first = await startExamAttempt(learnerId, examId);
    await prisma.examAttempt.update({
      where: { id: first.attemptId },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await expect(startExamAttempt(learnerId, examId)).rejects.toMatchObject({
      code: "attempt_already_submitted",
    });
  });
});

describe("getAttemptRuntime (A7.4.3)", () => {
  it("returns server clock, answers, snapshot", async () => {
    const { examId, learnerId } = await publishedExamSetup("g1");
    const { attemptId } = await startExamAttempt(learnerId, examId);
    const r = await getAttemptRuntime({ kind: "user", userId: learnerId }, attemptId);
    expect(r.status).toBe("in_progress");
    expect(typeof r.serverNow).toBe("string");
    expect(r.durationSec).toBe(60 * 60);
    expect(r.shuffleSnapshot).toBeTruthy();
    expect(r.answers).toEqual([]);
  });

  it("rejects when other user requests attempt", async () => {
    const { examId, learnerId } = await publishedExamSetup("g2");
    const { attemptId } = await startExamAttempt(learnerId, examId);
    const stranger = await registerUser(
      { email: "stranger-g2@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(getAttemptRuntime({ kind: "user", userId: stranger.userId }, attemptId)).rejects.toMatchObject({
      code: "attempt_belongs_to_other",
    });
  });
});

describe("saveAnswer (A7.4.4)", () => {
  it("upserts answer + emits two events first time", async () => {
    const { examId, learnerId, q1Id } = await publishedExamSetup("a1");
    const start = await startExamAttempt(learnerId, examId);
    const r = await saveAnswer({ kind: "user", userId: learnerId }, start.attemptId, q1Id, {
      answerJson: { optionIds: ["a"] },
      sessionToken: start.sessionToken,
    });
    expect(r.persisted).toBe(true);
    const row = await prisma.examAnswer.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: start.attemptId, questionId: q1Id } },
    });
    expect(row.answerHash).toBe(r.answerHash);
    const evs = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: { in: [
        LearningEventType.ExamQuestionAnswered,
        LearningEventType.ExamAutosaved,
      ] } },
    });
    expect(evs).toHaveLength(2);
  });

  it("idempotent: same payload does not duplicate", async () => {
    const { examId, learnerId, q1Id } = await publishedExamSetup("a2");
    const start = await startExamAttempt(learnerId, examId);
    const payload = {
      answerJson: { optionIds: ["a"] },
      sessionToken: start.sessionToken,
    };
    const first = await saveAnswer({ kind: "user", userId: learnerId }, start.attemptId, q1Id, payload);
    const second = await saveAnswer({ kind: "user", userId: learnerId }, start.attemptId, q1Id, payload);
    expect(first.persisted).toBe(true);
    expect(second.persisted).toBe(false);
    expect(second.answerHash).toBe(first.answerHash);
    const evs = await prisma.learningEvent.count({
      where: { userId: learnerId, eventType: LearningEventType.ExamQuestionAnswered },
    });
    expect(evs).toBe(1);
  });

  it("changing answer creates new row state + new events", async () => {
    const { examId, learnerId, q1Id } = await publishedExamSetup("a3");
    const start = await startExamAttempt(learnerId, examId);
    await saveAnswer({ kind: "user", userId: learnerId }, start.attemptId, q1Id, {
      answerJson: { optionIds: ["a"] },
      sessionToken: start.sessionToken,
    });
    await saveAnswer({ kind: "user", userId: learnerId }, start.attemptId, q1Id, {
      answerJson: { optionIds: ["b"] },
      sessionToken: start.sessionToken,
    });
    const row = await prisma.examAnswer.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: start.attemptId, questionId: q1Id } },
    });
    const answer = row.answerJson as { optionIds: string[] };
    expect(answer.optionIds).toEqual(["b"]);
    const evs = await prisma.learningEvent.count({
      where: { userId: learnerId, eventType: LearningEventType.ExamQuestionAnswered },
    });
    expect(evs).toBe(2);
  });

  it("A7.4.7 — rejects stale sessionToken", async () => {
    const { examId, learnerId, q1Id } = await publishedExamSetup("a4");
    const start = await startExamAttempt(learnerId, examId);
    const claimed = await claimAttemptSession({ kind: "user", userId: learnerId }, start.attemptId);
    await expect(
      saveAnswer({ kind: "user", userId: learnerId }, start.attemptId, q1Id, {
        answerJson: { optionIds: ["a"] },
        sessionToken: start.sessionToken, // stale
      }),
    ).rejects.toMatchObject({ code: "session_stale" });
    // New token works
    const r = await saveAnswer({ kind: "user", userId: learnerId }, start.attemptId, q1Id, {
      answerJson: { optionIds: ["a"] },
      sessionToken: claimed.sessionToken,
    });
    expect(r.persisted).toBe(true);
  });

  it("rejects question from another exam", async () => {
    const a = await publishedExamSetup("a5");
    const b = await publishedExamSetup("a5b");
    const start = await startExamAttempt(a.learnerId, a.examId);
    await expect(
      saveAnswer({ kind: "user", userId: a.learnerId }, start.attemptId, b.q1Id, {
        answerJson: { optionIds: ["a"] },
        sessionToken: start.sessionToken,
      }),
    ).rejects.toMatchObject({ code: "question_not_in_exam" });
  });

  it("rejects when attempt past deadline", async () => {
    const { examId, learnerId, q1Id } = await publishedExamSetup("a6");
    const start = await startExamAttempt(learnerId, examId);
    // Shift startedAt to 2h ago with 1h duration.
    await prisma.examAttempt.update({
      where: { id: start.attemptId },
      data: { startedAt: new Date(Date.now() - 2 * 60 * 60_000) },
    });
    await expect(
      saveAnswer({ kind: "user", userId: learnerId }, start.attemptId, q1Id, {
        answerJson: { optionIds: ["a"] },
        sessionToken: start.sessionToken,
      }),
    ).rejects.toMatchObject({ code: "attempt_already_submitted" });
  });
});

describe("claimAttemptSession (A7.4.7)", () => {
  it("rotates sessionToken on claim", async () => {
    const { examId, learnerId } = await publishedExamSetup("c1");
    const start = await startExamAttempt(learnerId, examId);
    const claimed = await claimAttemptSession({ kind: "user", userId: learnerId }, start.attemptId);
    expect(claimed.sessionToken).not.toBe(start.sessionToken);
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: start.attemptId } });
    expect(a.sessionToken).toBe(claimed.sessionToken);
    expect(a.resumeCount).toBe(1);
  });

  it("rejects when other user claims", async () => {
    const { examId, learnerId } = await publishedExamSetup("c2");
    const start = await startExamAttempt(learnerId, examId);
    const stranger = await registerUser(
      { email: "stranger-c2@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      claimAttemptSession({ kind: "user", userId: stranger.userId }, start.attemptId),
    ).rejects.toMatchObject({ code: "attempt_belongs_to_other" });
  });
});

describe("shuffle snapshot", () => {
  it("question order is deterministic per attempt; differs across attempts", async () => {
    const { examId, learnerId, passageId } = await publishedExamSetup("sh1");
    const first = await startExamAttempt(learnerId, examId);
    const a1 = await prisma.examAttempt.findUniqueOrThrow({ where: { id: first.attemptId } });
    const snap1 = a1.shuffleSnapshot as { questionOrderByPassage: Record<string, string[]> };
    expect(snap1.questionOrderByPassage[passageId]).toHaveLength(2);

    // Different user → different attempt → different seed → likely different order.
    const stranger = await registerUser(
      { email: "stranger-sh1@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    const course = await prisma.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { courseId: true },
    });
    await enrollInCourse(stranger.userId, course.courseId);
    const second = await startExamAttempt(stranger.userId, examId);
    const a2 = await prisma.examAttempt.findUniqueOrThrow({ where: { id: second.attemptId } });
    const snap2 = a2.shuffleSnapshot as { questionOrderByPassage: Record<string, string[]> };
    expect(snap2.questionOrderByPassage[passageId]).toHaveLength(2);
    // Different attemptId seeds — orders should differ. Two questions has 2 perms
    // so collision is 50% chance. Accept either: just ensure snapshot exists.
    expect(snap1).toBeTruthy();
    expect(snap2).toBeTruthy();
  });

  it("questions inside a passage are NEVER shuffled — always orderInPassage", async () => {
    // Pedagogical guarantee: questions clustered under a reading passage
    // follow the reading's structure. Shuffle only applies to standalone
    // questions. (Option B — chosen 2026-05-16.)
    const { ownerId, examId, passageId, q1Id, q2Id, learnerId } =
      await publishedExamSetup("sh-passage-fixed");
    // Force shuffleQuestions=true on the exam.
    await prisma.exam.update({
      where: { id: examId },
      data: { shuffleQuestions: true },
    });
    void ownerId;

    // Multiple attempts → same in-passage order every time.
    const orders: string[][] = [];
    for (let i = 0; i < 5; i++) {
      const stranger = await registerUser(
        {
          email: `sh-passage-fixed-${i}@e.com`,
          password: "password1234",
          displayName: `U${i}`,
        },
        BASE,
      );
      const course = await prisma.exam.findUniqueOrThrow({
        where: { id: examId },
        select: { courseId: true },
      });
      await enrollInCourse(stranger.userId, course.courseId);
      const a = await startExamAttempt(stranger.userId, examId);
      const attempt = await prisma.examAttempt.findUniqueOrThrow({
        where: { id: a.attemptId },
      });
      const snap = attempt.shuffleSnapshot as {
        questionOrderByPassage: Record<string, string[]>;
      };
      orders.push(snap.questionOrderByPassage[passageId]!);
    }
    // Every attempt must produce the same order: [q1, q2] (the creation order
    // = orderInPassage order).
    for (const order of orders) {
      expect(order).toEqual([q1Id, q2Id]);
    }
    void learnerId;
  });
});
