import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  autoSubmitExpiredAttempts,
  createExam,
  createExamQuestion,
  createPassage,
  getExamAttemptResult,
  getExamAttemptReview,
  publishExam,
  regradeExamAttempts,
  saveAnswer,
  startExamAttempt,
  submitExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcqConfig = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
    { id: "c", label: "C", isCorrect: false },
  ],
});

interface SetupOpts {
  includeEssay?: boolean;
  /** Attached to q1's config — drives the learner-facing "Giải thích" block. */
  explanation?: string;
  hideResults?: boolean;
}

async function setup(slug: string, opts: SetupOpts = {}) {
  const owner = await registerUser(
    { email: `sub-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `sub-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin: 60,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
  });
  const skill = await prisma.skill.create({
    data: { code: `sub.${slug}`, name: "S" },
  });
  const q1 = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q1",
    config: opts.explanation
      ? { ...mcqConfig(), explanation: opts.explanation }
      : mcqConfig(),
    points: 5,
    skillIds: [skill.id],
  });
  const q2 = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q2",
    config: mcqConfig(),
    points: 5,
    skillIds: [skill.id],
  });
  const q3 = opts.includeEssay
    ? await createExamQuestion(owner.userId, examId, {
        type: "essay",
        prompt: "Discuss",
        config: { rubric: "x" },
        points: 10,
        skillIds: [skill.id],
      })
    : null;
  if (opts.hideResults) {
    await prisma.exam.update({
      where: { id: examId },
      data: { showResultsAfterSubmit: false },
    });
  }
  await publishExam(owner.userId, examId);
  const learner = await registerUser(
    { email: `sub-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  return {
    ownerId: owner.userId,
    examId,
    learnerId: learner.userId,
    q1: q1.questionId,
    q2: q2.questionId,
    q3: q3?.questionId ?? null,
  };
}

async function answerWithToken(
  learnerId: string,
  attemptId: string,
  qid: string,
  payload: unknown,
  sessionToken: string,
) {
  return saveAnswer({ kind: "user", userId: learnerId }, attemptId, qid, {
    answerJson: payload,
    sessionToken,
  });
}

describe("submitExamAttempt (A7.5.1)", () => {
  it("auto-grades MCQs; transitions to graded when fully auto", async () => {
    const s = await setup("m1");
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await answerWithToken(s.learnerId, start.attemptId, s.q2, { optionIds: ["b"] }, start.sessionToken);
    const r = await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    expect(r.fullyGraded).toBe(true);
    expect(r.status).toBe("graded");
    expect(r.autoScore).toBe(5); // q1 correct, q2 wrong → 5 of 10
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: start.attemptId } });
    expect(a.status).toBe("graded");
    expect(a.scorePct).toBe(50);
    // passScore default 50 → passed
    expect(a.passed).toBe(true);
    const grade = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamGraded, userId: s.learnerId },
    });
    expect(grade).not.toBeNull();
  });

  it("stays in submitted when essay pending", async () => {
    const s = await setup("m2", { includeEssay: true });
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await answerWithToken(s.learnerId, start.attemptId, s.q3!, { text: "essay body" }, start.sessionToken);
    const r = await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    expect(r.fullyGraded).toBe(false);
    expect(r.status).toBe("submitted");
    expect(r.autoScore).toBe(5); // q1 correct only
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: start.attemptId } });
    expect(a.passed).toBeNull();
    expect(a.scorePct).toBeNull();
    // Essay row exists with needsGrading=true.
    const essay = await prisma.examAnswer.findUnique({
      where: { attemptId_questionId: { attemptId: start.attemptId, questionId: s.q3! } },
    });
    expect(essay?.needsGrading).toBe(true);
    expect(essay?.autoScore).toBeNull();
  });

  it("creates zero-score rows for unanswered auto questions", async () => {
    const s = await setup("m3");
    const start = await startExamAttempt(s.learnerId, s.examId);
    // Submit without answering anything.
    const r = await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    expect(r.fullyGraded).toBe(true);
    expect(r.autoScore).toBe(0);
    const rows = await prisma.examAnswer.findMany({ where: { attemptId: start.attemptId } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.autoScore === 0)).toBe(true);
  });

  it("is idempotent — second submit returns current state", async () => {
    const s = await setup("m4");
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    const first = await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    const second = await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    expect(second.status).toBe(first.status);
    expect(second.autoScore).toBe(first.autoScore);
    const evs = await prisma.learningEvent.count({
      where: {
        eventType: LearningEventType.ExamSubmitted,
        userId: s.learnerId,
      },
    });
    expect(evs).toBe(1);
  });

  it("rejects when other user submits", async () => {
    const s = await setup("m5");
    const start = await startExamAttempt(s.learnerId, s.examId);
    const other = await registerUser(
      { email: "stranger-m5@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(submitExamAttempt({ kind: "user", userId: other.userId }, start.attemptId)).rejects.toMatchObject({
      code: "attempt_belongs_to_other",
    });
  });
});

describe("autoSubmitExpiredAttempts (A7.5.2)", () => {
  it("flips expired attempts to auto_submitted; leaves fresh ones alone", async () => {
    const s = await setup("a1");
    const expired = await startExamAttempt(s.learnerId, s.examId);
    // Shift startedAt 2h ago with 1h duration → expired.
    await prisma.examAttempt.update({
      where: { id: expired.attemptId },
      data: { startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });
    const result = await autoSubmitExpiredAttempts();
    expect(result.processed).toBeGreaterThanOrEqual(1);
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: expired.attemptId } });
    // Fully auto-gradeable (no essay) → graded after autosubmit.
    expect(a.status).toBe("graded");
    const ev = await prisma.learningEvent.findFirst({
      where: {
        eventType: LearningEventType.ExamAutoSubmitted,
        userId: s.learnerId,
      },
    });
    expect(ev).not.toBeNull();
    expect((ev!.payload as { reason: string }).reason).toBe("timer_expired");
  });

  it("is idempotent across cron ticks", async () => {
    const s = await setup("a2");
    const start = await startExamAttempt(s.learnerId, s.examId);
    await prisma.examAttempt.update({
      where: { id: start.attemptId },
      data: { startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });
    await autoSubmitExpiredAttempts();
    await autoSubmitExpiredAttempts();
    const evs = await prisma.learningEvent.count({
      where: {
        eventType: LearningEventType.ExamAutoSubmitted,
        userId: s.learnerId,
      },
    });
    expect(evs).toBe(1);
  });
});

describe("getExamAttemptResult (A7.5.4)", () => {
  it("returns full result after graded", async () => {
    const s = await setup("r1");
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    const r = await getExamAttemptResult(s.learnerId, start.attemptId);
    expect(r.status).toBe("graded");
    expect(r.score).toBe(5);
    expect(r.scorePct).toBe(50);
    expect(r.passed).toBe(true);
    expect(r.showDetails).toBe(true);
    expect(r.answers).toHaveLength(2);
  });

  it("hides score while pending manual grade", async () => {
    const s = await setup("r2", { includeEssay: true });
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await answerWithToken(s.learnerId, start.attemptId, s.q3!, { text: "essay" }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    const r = await getExamAttemptResult(s.learnerId, start.attemptId);
    expect(r.status).toBe("submitted");
    expect(r.score).toBeNull();
    expect(r.scorePct).toBeNull();
    expect(r.passed).toBeNull();
    expect(r.showDetails).toBe(false);
  });

  it("rejects when attempt still in_progress", async () => {
    const s = await setup("r3");
    const start = await startExamAttempt(s.learnerId, s.examId);
    await expect(getExamAttemptResult(s.learnerId, start.attemptId)).rejects.toBeTruthy();
  });
});

describe("regradeExamAttempts", () => {
  it("re-scores submitted attempts theo đáp án MỚI; ghi history", async () => {
    const s = await setup("rg1");
    const start = await startExamAttempt(s.learnerId, s.examId);
    // q1=a (đúng, 5đ), q2=b (sai theo đáp án gốc → 0).
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await answerWithToken(s.learnerId, start.attemptId, s.q2, { optionIds: ["b"] }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    const before = await prisma.examAttempt.findUniqueOrThrow({ where: { id: start.attemptId } });
    expect(before.score).toBe(5);
    expect(before.passed).toBe(true); // 50% == passScore 50

    // Instructor sửa đáp án q2: giờ "b" là đúng.
    await prisma.examQuestion.update({
      where: { id: s.q2 },
      data: {
        config: {
          options: [
            { id: "a", label: "A", isCorrect: false },
            { id: "b", label: "B", isCorrect: true },
            { id: "c", label: "C", isCorrect: false },
          ],
        },
      },
    });

    const res = await regradeExamAttempts(s.ownerId, s.examId);
    expect(res.attemptsChanged).toBeGreaterThanOrEqual(1);

    const after = await prisma.examAttempt.findUniqueOrThrow({ where: { id: start.attemptId } });
    expect(after.score).toBe(10); // q1 + q2 đều đúng
    expect(after.scorePct).toBe(100);
    expect(after.passed).toBe(true);

    // History ghi lại thay đổi điểm câu q2.
    const q2Answer = await prisma.examAnswer.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: start.attemptId, questionId: s.q2 } },
    });
    expect(q2Answer.autoScore).toBe(5);
    const hist = await prisma.examGradeHistory.findFirst({ where: { answerId: q2Answer.id } });
    expect(hist).not.toBeNull();
    expect(hist?.newScore).toBe(5);
  });

  it("giữ nguyên điểm chấm tay của câu tự luận", async () => {
    const s = await setup("rg2", { includeEssay: true });
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await answerWithToken(s.learnerId, start.attemptId, s.q3!, { text: "essay" }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);
    // Chấm tay essay = 8đ.
    const essayAns = await prisma.examAnswer.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: start.attemptId, questionId: s.q3! } },
    });
    await prisma.examAnswer.update({
      where: { id: essayAns.id },
      data: { manualScore: 8, needsGrading: false },
    });

    await regradeExamAttempts(s.ownerId, s.examId);

    const after = await prisma.examAnswer.findUniqueOrThrow({ where: { id: essayAns.id } });
    expect(after.manualScore).toBe(8); // không bị đụng
    expect(after.needsGrading).toBe(false);
  });
});

describe("getExamAttemptReview — giải thích đáp án", () => {
  it("trả giải thích từ config sau khi bài đã chấm", async () => {
    const s = await setup("rev1", { explanation: "A đúng vì theo định nghĩa." });
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);

    const r = await getExamAttemptReview(s.learnerId, start.attemptId);
    const q1 = r.questions.find((q) => q.id === s.q1)!;
    expect(q1.explanation).toBe("A đúng vì theo định nghĩa.");
  });

  it("để null khi câu hỏi không có giải thích", async () => {
    const s = await setup("rev2", { explanation: "Chỉ q1 có." });
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);

    const r = await getExamAttemptReview(s.learnerId, start.attemptId);
    expect(r.questions.find((q) => q.id === s.q2)!.explanation).toBeNull();
  });

  it("không lộ gì khi đề tắt hiện kết quả sau nộp", async () => {
    const s = await setup("rev3", { explanation: "Bí mật.", hideResults: true });
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);

    await expect(getExamAttemptReview(s.learnerId, start.attemptId)).rejects.toBeTruthy();
  });

  it("không lộ gì khi bài còn chờ chấm tay", async () => {
    const s = await setup("rev4", { explanation: "Bí mật.", includeEssay: true });
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await answerWithToken(s.learnerId, start.attemptId, s.q3!, { text: "essay" }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);

    await expect(getExamAttemptReview(s.learnerId, start.attemptId)).rejects.toBeTruthy();
  });

  it("không cho học sinh khác đọc giải thích của bài này", async () => {
    const s = await setup("rev5", { explanation: "Bí mật." });
    const other = await setup("rev6");
    const start = await startExamAttempt(s.learnerId, s.examId);
    await answerWithToken(s.learnerId, start.attemptId, s.q1, { optionIds: ["a"] }, start.sessionToken);
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, start.attemptId);

    await expect(getExamAttemptReview(other.learnerId, start.attemptId)).rejects.toBeTruthy();
  });
});
