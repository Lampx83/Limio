import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createExamQuestion,
  ExamError,
  listAttemptIncidents,
  logExamIncident,
  publishExam,
  startExamAttempt,
  submitExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcqConfig = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setupInProgress(slug: string) {
  const owner = await registerUser(
    { email: `inc-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `inc-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "E",
    durationMin: 60,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
  });
  const skill = await prisma.skill.create({
    data: { code: `inc.${slug}`, name: "S" },
  });
  const q = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: mcqConfig(),
    points: 5,
    skillIds: [skill.id],
  });
  await publishExam(owner.userId, examId);
  const learner = await registerUser(
    { email: `inc-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const start = await startExamAttempt(learner.userId, examId);
  return {
    learnerId: learner.userId,
    attemptId: start.attemptId,
    questionId: q.questionId,
  };
}

describe("logExamIncident (A7.7.3)", () => {
  it("appends row + emits exam.incident.flagged", async () => {
    const s = await setupInProgress("i1");
    const r = await logExamIncident(s.learnerId, s.attemptId, { type: "tab_blur" });
    const rows = await prisma.examIncident.findMany({
      where: { attemptId: s.attemptId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(r.incidentId);
    expect(rows[0]!.type).toBe("tab_blur");
    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamIncidentFlagged },
    });
    expect(ev).not.toBeNull();
    expect((ev!.payload as { type: string }).type).toBe("tab_blur");
  });

  it("stores type-specific payload", async () => {
    const s = await setupInProgress("i2");
    await logExamIncident(s.learnerId, s.attemptId, {
      type: "paste",
      payload: { pastedLength: 124 },
    });
    const row = await prisma.examIncident.findFirstOrThrow({
      where: { attemptId: s.attemptId },
    });
    expect((row.payload as { pastedLength: number }).pastedLength).toBe(124);
  });

  it("allows multiple incidents of same type (no dedup)", async () => {
    const s = await setupInProgress("i3");
    await logExamIncident(s.learnerId, s.attemptId, { type: "tab_blur" });
    await logExamIncident(s.learnerId, s.attemptId, { type: "tab_blur" });
    const rows = await prisma.examIncident.findMany({
      where: { attemptId: s.attemptId },
    });
    expect(rows).toHaveLength(2);
  });

  it("rejects when other user attempts to log", async () => {
    const s = await setupInProgress("i4");
    const stranger = await registerUser(
      { email: "stranger-i4@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      logExamIncident(stranger.userId, s.attemptId, { type: "tab_blur" }),
    ).rejects.toMatchObject({ code: "attempt_belongs_to_other" });
  });

  it("rejects after submission", async () => {
    const s = await setupInProgress("i5");
    await submitExamAttempt(s.learnerId, s.attemptId);
    await expect(
      logExamIncident(s.learnerId, s.attemptId, { type: "tab_blur" }),
    ).rejects.toMatchObject({ code: "attempt_already_submitted" });
  });

  it("rejects unknown incident type", async () => {
    const s = await setupInProgress("i6");
    await expect(
      logExamIncident(s.learnerId, s.attemptId, { type: "weird_type" }),
    ).rejects.toBeInstanceOf(ExamError);
  });
});

describe("listAttemptIncidents", () => {
  it("returns incidents in chronological order", async () => {
    const s = await setupInProgress("l1");
    const a = await logExamIncident(s.learnerId, s.attemptId, { type: "tab_blur" });
    const b = await logExamIncident(s.learnerId, s.attemptId, { type: "paste" });
    const list = await listAttemptIncidents(s.attemptId);
    expect(list.map((x) => x.id)).toEqual([a.incidentId, b.incidentId]);
  });
});
