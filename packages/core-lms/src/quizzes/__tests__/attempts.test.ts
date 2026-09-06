import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { createQuiz } from "../quizzes";
import { createQuestion } from "../questions";
import {
  getAttemptResult,
  startAttempt,
  submitAnswer,
  submitAttempt,
  QuizError,
} from "../";

const BASE = "http://localhost:3000";

interface SetupOpts {
  withMisconception?: boolean;
  maxAttempts?: number | null;
  requireConfidence?: boolean;
  timeLimitSec?: number | null;
}

async function setup(slug: string, opts: SetupOpts = {}) {
  const owner = await registerUser(
    { email: `o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const learner = await registerUser(
    { email: `l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  const c = await createCourse(owner.userId, { title: slug, description: "x", slug });
  const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });
  const skill = await createSkill({ code: `skill.aq.${slug}`, name: "S" });
  await tagLessonSkill(owner.userId, l.lessonId, { skillId: skill.skillId });
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(learner.userId, c.courseId);

  const quizPayload: Record<string, unknown> = {
    title: "Q",
    requireConfidence: opts.requireConfidence ?? false,
  };
  if (opts.maxAttempts != null) quizPayload.maxAttempts = opts.maxAttempts;
  if (opts.timeLimitSec != null) quizPayload.timeLimitSec = opts.timeLimitSec;
  const q = await createQuiz(
    owner.userId,
    { courseId: c.courseId, lessonId: l.lessonId },
    quizPayload,
  );

  let misconceptionId: string | null = null;
  if (opts.withMisconception) {
    const m2 = await prisma.misconception.upsert({
      where: { code: `mc-${slug}` },
      update: {},
      create: { code: `mc-${slug}`, name: "M", description: "d" },
    });
    misconceptionId = m2.id;
  }

  // Q1: MCQ with single correct + misconception on wrong (if requested)
  const qq1 = await createQuestion(owner.userId, q.quizId, {
    type: "mcq",
    prompt: "1+1=?",
    explanation: "Two",
    points: 2,
    orderIndex: 0,
    options: [
      { label: "2", isCorrect: true },
      { label: "3", isCorrect: false, misconceptionId },
      { label: "1", isCorrect: false },
    ],
  });
  // Q2: TF
  const qq2 = await createQuestion(owner.userId, q.quizId, {
    type: "true_false",
    prompt: "Sky is blue",
    points: 1,
    orderIndex: 1,
    options: [
      { label: "T", isCorrect: true },
      { label: "F", isCorrect: false },
    ],
  });
  // Q3: fill_in
  const qq3 = await createQuestion(owner.userId, q.quizId, {
    type: "fill_in",
    prompt: "What is 5+5?",
    points: 1,
    orderIndex: 2,
    options: [{ label: "10", isCorrect: true }],
  });

  return {
    ownerId: owner.userId,
    learnerId: learner.userId,
    courseId: c.courseId,
    quizId: q.quizId,
    questionIds: [qq1.questionId, qq2.questionId, qq3.questionId],
    misconceptionId,
  };
}

async function getOptionId(questionId: string, label: string): Promise<string> {
  const o = await prisma.questionOption.findFirstOrThrow({ where: { questionId, label } });
  return o.id;
}

describe("startAttempt", () => {
  it("AC-A4.4: creates attempt; emits quiz.started", async () => {
    const { learnerId, courseId, quizId } = await setup("a1");
    const r = await startAttempt(learnerId, quizId);
    expect(r.created).toBe(true);

    const events = await prisma.learningEvent.findMany({
      where: { userId: learnerId, eventType: LearningEventType.QuizStarted },
    });
    expect(events).toHaveLength(1);
    void courseId;
  });

  it("idempotent on in_progress: returns same attempt", async () => {
    const { learnerId, quizId } = await setup("a2");
    const r1 = await startAttempt(learnerId, quizId);
    const r2 = await startAttempt(learnerId, quizId);
    expect(r1.attemptId).toBe(r2.attemptId);
    expect(r2.created).toBe(false);
  });

  it("AC-A4.4: max_attempts enforced after submit", async () => {
    const { learnerId, quizId } = await setup("a3", { maxAttempts: 1 });
    const r1 = await startAttempt(learnerId, quizId);
    await submitAttempt(learnerId, r1.attemptId);
    await expect(startAttempt(learnerId, quizId)).rejects.toMatchObject({
      code: "max_attempts_exceeded",
    });
  });

  it("not_enrolled blocks outsider", async () => {
    const { quizId } = await setup("a4");
    const outsider = await registerUser(
      { email: "out-a4@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(startAttempt(outsider.userId, quizId)).rejects.toMatchObject({
      code: "not_enrolled",
    });
  });
});

describe("submitAnswer + submitAttempt", () => {
  it("grades all 3 question types end-to-end + sets passed", async () => {
    const { learnerId, quizId, questionIds } = await setup("a5");
    const att = await startAttempt(learnerId, quizId);

    // Q1 (MCQ): pick correct "2"
    const q1Correct = await getOptionId(questionIds[0]!, "2");
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [q1Correct],
    });

    // Q2 (TF): pick T
    const q2T = await getOptionId(questionIds[1]!, "T");
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[1]!,
      response: [q2T],
    });

    // Q3 (fill_in): "10"
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[2]!,
      response: "10",
    });

    const result = await submitAttempt(learnerId, att.attemptId);
    // 4 / 4 points → 100%
    expect(result.scorePct).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.correctCount).toBe(3);
  });

  it("partial credit + fail when below pass threshold", async () => {
    const { learnerId, quizId, questionIds } = await setup("a6");
    const att = await startAttempt(learnerId, quizId);
    const wrong = await getOptionId(questionIds[0]!, "3");
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [wrong],
    });
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[2]!,
      response: "wrong",
    });
    // Q2 unanswered
    const result = await submitAttempt(learnerId, att.attemptId);
    expect(result.scorePct).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.correctCount).toBe(0);
  });

  it("AC-A4.7: result includes misconception code for tagged wrong choice", async () => {
    const { learnerId, quizId, questionIds } = await setup("a7", { withMisconception: true });
    const att = await startAttempt(learnerId, quizId);
    const wrong = await getOptionId(questionIds[0]!, "3");
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [wrong],
    });
    await submitAttempt(learnerId, att.attemptId);
    const result = await getAttemptResult(learnerId, att.attemptId);
    const q1 = result.items[0]!;
    expect(q1.isCorrect).toBe(false);
    expect(q1.misconceptionCode).toBe("mc-a7");
  });

  it("AC-A4.6: confidence required when quiz.requireConfidence=true", async () => {
    const { learnerId, quizId, questionIds } = await setup("a8", { requireConfidence: true });
    const att = await startAttempt(learnerId, quizId);
    const correct = await getOptionId(questionIds[0]!, "2");
    await expect(
      submitAnswer(learnerId, att.attemptId, {
        questionId: questionIds[0]!,
        response: [correct],
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    // With confidence: ok
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [correct],
      confidence: 4,
    });
  });

  it("AC-A4.13: time_limit exceeded → expired:true at submit", async () => {
    const { learnerId, quizId, questionIds } = await setup("a9", { timeLimitSec: 1 });
    const att = await startAttempt(learnerId, quizId);
    // Force startedAt back in time so elapsed > 1s.
    await prisma.quizAttempt.update({
      where: { id: att.attemptId },
      data: { startedAt: new Date(Date.now() - 5_000) },
    });
    const correct = await getOptionId(questionIds[0]!, "2");
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [correct],
    });
    const result = await submitAttempt(learnerId, att.attemptId);
    expect(result.expired).toBe(true);
  });

  it("AC-A4.12: outsider cannot see/submit a different user's attempt", async () => {
    const { learnerId, quizId } = await setup("a10");
    const att = await startAttempt(learnerId, quizId);
    const outsider = await registerUser(
      { email: "out-a10@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(getAttemptResult(outsider.userId, att.attemptId)).rejects.toMatchObject({
      code: "attempt_belongs_to_other",
    });
  });

  it("cannot submit twice", async () => {
    const { learnerId, quizId } = await setup("a11");
    const att = await startAttempt(learnerId, quizId);
    await submitAttempt(learnerId, att.attemptId);
    await expect(submitAttempt(learnerId, att.attemptId)).rejects.toMatchObject({
      code: "attempt_already_submitted",
    });
  });

  it("rejects answer for question not in this quiz", async () => {
    const { learnerId, quizId } = await setup("a12");
    const other = await setup("a12-other");
    const att = await startAttempt(learnerId, quizId);
    await expect(
      submitAnswer(learnerId, att.attemptId, {
        questionId: other.questionIds[0]!,
        response: ["x"],
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("AC-A4.11: result hides nothing — includes correctOptionIds for all questions", async () => {
    const { learnerId, quizId } = await setup("a13");
    const att = await startAttempt(learnerId, quizId);
    await submitAttempt(learnerId, att.attemptId);
    const result = await getAttemptResult(learnerId, att.attemptId);
    expect(result.items.every((i) => i.correctOptionIds.length > 0)).toBe(true);
  });

  it("rejects no_questions on empty quiz", async () => {
    const owner = await registerUser(
      { email: "o-noq@e.com", password: "password1234", displayName: "O" },
      BASE,
    );
    const learner = await registerUser(
      { email: "l-noq@e.com", password: "password1234", displayName: "L" },
      BASE,
    );
    const c = await createCourse(owner.userId, { title: "noq", description: "x", slug: "noq" });
    const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
    const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });
    const s = await createSkill({ code: "skill.noq", name: "S" });
    await tagLessonSkill(owner.userId, l.lessonId, { skillId: s.skillId });
    await publishCourse(owner.userId, c.courseId);
    await enrollInCourse(learner.userId, c.courseId);
    const q = await createQuiz(owner.userId, { courseId: c.courseId }, { title: "empty" });
    await expect(startAttempt(learner.userId, q.quizId)).rejects.toBeInstanceOf(QuizError);
  });
});

describe("B12 — thời gian thật của từng câu", () => {
  it("lưu latencyMs do máy khách gửi, tách khỏi responseTimeMs cộng dồn", async () => {
    const { learnerId, quizId, questionIds } = await setup("b12a");
    const att = await startAttempt(learnerId, quizId);
    const correct = await getOptionId(questionIds[0]!, "2");
    // Để lượt làm bài trôi qua một chút, nếu không thì 40 ms "suy nghĩ" sẽ dài
    // hơn cả lượt làm bài và bị loại đúng theo quy tắc bên dưới.
    await new Promise((r) => setTimeout(r, 120));

    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [correct],
      latencyMs: 40,
    });

    const row = await prisma.answerResponse.findFirstOrThrow({
      where: { attemptId: att.attemptId, questionId: questionIds[0]! },
    });
    expect(row.latencyMs).toBe(40);
    // Cột cũ giữ nguyên nghĩa cũ — thời gian từ lúc bắt đầu cả lượt làm bài.
    expect(row.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(row.revisionCount).toBe(0);
  });

  it("để trống latencyMs khi máy khách không gửi — không lấy tạm số cộng dồn", async () => {
    const { learnerId, quizId, questionIds } = await setup("b12b");
    const att = await startAttempt(learnerId, quizId);
    const correct = await getOptionId(questionIds[0]!, "2");

    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [correct],
    });

    const row = await prisma.answerResponse.findFirstOrThrow({
      where: { attemptId: att.attemptId, questionId: questionIds[0]! },
    });
    expect(row.latencyMs).toBeNull();
  });

  it("bỏ hẳn số đo khi máy khách khai dài hơn cả lượt làm bài, không kẹp lại", async () => {
    const { learnerId, quizId, questionIds } = await setup("b12c");
    const att = await startAttempt(learnerId, quizId);
    const correct = await getOptionId(questionIds[0]!, "2");

    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [correct],
      latencyMs: 60 * 60 * 1000,
    });

    const row = await prisma.answerResponse.findFirstOrThrow({
      where: { attemptId: att.attemptId, questionId: questionIds[0]! },
    });
    // Không kẹp về một giá trị trông hợp lý — để trống, vì số đó không tin được.
    expect(row.latencyMs).toBeNull();
  });

  it("đếm số lần sửa lại đáp án — đáp án cũ bị ghi đè nên không còn dấu vết nào khác", async () => {
    const { learnerId, quizId, questionIds } = await setup("b12d");
    const att = await startAttempt(learnerId, quizId);
    const right = await getOptionId(questionIds[0]!, "2");
    const wrong = await getOptionId(questionIds[0]!, "3");

    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [wrong],
      latencyMs: 1000,
    });
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [right],
      latencyMs: 5000,
    });
    await submitAnswer(learnerId, att.attemptId, {
      questionId: questionIds[0]!,
      response: [wrong],
      latencyMs: 9000,
    });

    const row = await prisma.answerResponse.findFirstOrThrow({
      where: { attemptId: att.attemptId, questionId: questionIds[0]! },
    });
    expect(row.revisionCount).toBe(2);
    expect(row.isCorrect).toBe(false);
  });

  it("từ chối latencyMs âm hoặc quá trần hai tiếng", async () => {
    const { learnerId, quizId, questionIds } = await setup("b12e");
    const att = await startAttempt(learnerId, quizId);
    const correct = await getOptionId(questionIds[0]!, "2");

    for (const bad of [-1, 3 * 60 * 60 * 1000]) {
      await expect(
        submitAnswer(learnerId, att.attemptId, {
          questionId: questionIds[0]!,
          response: [correct],
          latencyMs: bad,
        }),
      ).rejects.toThrow(QuizError);
    }
  });
});
