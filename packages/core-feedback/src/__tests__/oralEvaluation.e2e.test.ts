import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  createCourse,
  createExam,
  createOralMaterialDocument,
  createOralMaterialTopicList,
  enrollInCourse,
  publishExam,
  registerUser,
  startOralExamAttempt,
} from "@feedbackme/core-lms";
import { AiTutorError } from "../aiTutor/errors";
import { generateOralExamEvaluation } from "../oralExam/evaluation";
import type { ChatComputeFn } from "../oralExam/chat";

const BASE = "http://localhost:3000";

function scriptedChat(reply: string): ChatComputeFn {
  return async () => ({ content: reply, inputTokens: 15, outputTokens: 40 });
}

async function setup(slug: string, opts: { withRubric?: boolean } = {}) {
  const owner = await registerUser(
    { email: `oe-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `oe-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin: 20,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  await createOralMaterialTopicList(owner.userId, examId, { title: "Chủ đề", text: "x" });
  if (opts.withRubric) {
    await createOralMaterialDocument(owner.userId, examId, {
      type: "rubric",
      title: "Rubric",
      s3Key: "r.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      extractedText: "5đ: nêu đúng định nghĩa. 5đ: cho ví dụ đúng.",
    });
  }
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `oe-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const { attemptId } = await startOralExamAttempt(learner.userId, examId);
  await prisma.oralExamTurn.create({
    data: { attemptId, role: "examiner", content: "Vòng lặp for hoạt động thế nào?" },
  });
  await prisma.oralExamTurn.create({
    data: { attemptId, role: "student", content: "For lặp qua từng phần tử của mảng." },
  });
  return { ownerId: owner.userId, examId, learnerId: learner.userId, attemptId };
}

describe("generateOralExamEvaluation (A6.4)", () => {
  it("throws attempt_not_ended while the attempt is still in_progress", async () => {
    const s = await setup("t1");
    await prisma.examAttempt.update({ where: { id: s.attemptId }, data: { status: "in_progress" } });
    await expect(
      generateOralExamEvaluation(s.ownerId, s.attemptId, scriptedChat("{}")),
    ).rejects.toMatchObject({ code: "validation_failed", details: "attempt_not_ended" });
  });

  it("accepts an attempt the timeout cron closed as auto_submitted", async () => {
    const s = await setup("t1b");
    await prisma.examAttempt.update({
      where: { id: s.attemptId },
      data: { status: "auto_submitted" },
    });
    const reply = JSON.stringify({ score: 55, summary: "OK", breakdown: [] });
    const r = await generateOralExamEvaluation(s.ownerId, s.attemptId, scriptedChat(reply));
    expect(r.aiSuggestedScore).toBe(55);
  });

  it("parses a valid JSON reply into score + summary + breakdown", async () => {
    const s = await setup("t2");
    await prisma.examAttempt.update({ where: { id: s.attemptId }, data: { status: "submitted" } });
    const reply = JSON.stringify({
      score: 82,
      summary: "Nắm khá vững khái niệm vòng lặp.",
      breakdown: [{ topic: "Vòng lặp for", note: "Trả lời đúng trọng tâm." }],
    });
    const r = await generateOralExamEvaluation(s.ownerId, s.attemptId, scriptedChat(reply));
    expect(r.aiSuggestedScore).toBe(82);
    expect(r.aiSummary).toBe("Nắm khá vững khái niệm vòng lặp.");

    const evaluation = await prisma.oralExamEvaluation.findUniqueOrThrow({
      where: { attemptId: s.attemptId },
    });
    expect(evaluation.aiSuggestedScore).toBe(82);
    expect(evaluation.status).toBe("pending_review");
    expect(evaluation.aiRubricBreakdown).toEqual([
      { topic: "Vòng lặp for", note: "Trả lời đúng trọng tâm." },
    ]);
  });

  it("keeps the raw text as summary and leaves score null when JSON parsing fails", async () => {
    const s = await setup("t3");
    await prisma.examAttempt.update({ where: { id: s.attemptId }, data: { status: "submitted" } });
    const r = await generateOralExamEvaluation(
      s.ownerId,
      s.attemptId,
      scriptedChat("Xin lỗi, tôi không chấm được."),
    );
    expect(r.aiSuggestedScore).toBeNull();
    expect(r.aiSummary).toBe("Xin lỗi, tôi không chấm được.");
  });

  it("includes the rubric material text in the grading prompt when present", async () => {
    const s = await setup("t4", { withRubric: true });
    await prisma.examAttempt.update({ where: { id: s.attemptId }, data: { status: "submitted" } });
    let seenPrompt = "";
    const capture: ChatComputeFn = async (messages) => {
      seenPrompt = messages[0]!.content;
      return { content: JSON.stringify({ score: 70, summary: "ok" }), inputTokens: 1, outputTokens: 1 };
    };
    await generateOralExamEvaluation(s.ownerId, s.attemptId, capture);
    expect(seenPrompt).toContain("nêu đúng định nghĩa");
  });

  it("rejects regenerating once the instructor has already graded", async () => {
    const s = await setup("t5");
    await prisma.examAttempt.update({ where: { id: s.attemptId }, data: { status: "submitted" } });
    await prisma.oralExamEvaluation.create({
      data: { attemptId: s.attemptId, instructorScore: 90, status: "approved" },
    });
    await expect(
      generateOralExamEvaluation(s.ownerId, s.attemptId, scriptedChat("{}")),
    ).rejects.toMatchObject({ code: "validation_failed", details: "already_graded" });
  });

  it("records AiUsageLog and emits exam.oral_evaluation.generated", async () => {
    const s = await setup("t6");
    await prisma.examAttempt.update({ where: { id: s.attemptId }, data: { status: "submitted" } });
    await generateOralExamEvaluation(
      s.ownerId,
      s.attemptId,
      scriptedChat(JSON.stringify({ score: 60, summary: "ok" })),
    );
    const usage = await prisma.aiUsageLog.findFirst({
      where: { userId: s.ownerId, model: "gpt-4o-mini" },
    });
    expect(usage?.tokensInput).toBe(15);
    expect(usage?.tokensOutput).toBe(40);

    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamOralEvaluationGenerated, userId: s.ownerId },
    });
    expect((ev!.payload as Record<string, unknown>).aiSuggestedScore).toBe(60);
  });

  it("throws an AiTutorError, not a generic Error, on bad input", async () => {
    const s = await setup("t7");
    try {
      await generateOralExamEvaluation(s.ownerId, "00000000-0000-0000-0000-000000000000", scriptedChat("{}"));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AiTutorError);
    }
  });
});
