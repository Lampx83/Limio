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
  INCIDENT_DEDUPE_WINDOW_MS,
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
    const r = await logExamIncident({ kind: "user", userId: s.learnerId }, s.attemptId, { type: "tab_blur" });
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
    await logExamIncident({ kind: "user", userId: s.learnerId }, s.attemptId, {
      type: "paste",
      payload: { pastedLength: 124 },
    });
    const row = await prisma.examIncident.findFirstOrThrow({
      where: { attemptId: s.attemptId },
    });
    expect((row.payload as { pastedLength: number }).pastedLength).toBe(124);
  });

  it("merges the same type within the dedupe window: a burst becomes ONE row (real case: 1,058 tab_blur in <1 min)", async () => {
    const s = await setupInProgress("i3");
    const subject = { kind: "user", userId: s.learnerId } as const;
    const first = await logExamIncident(subject, s.attemptId, { type: "tab_blur" });
    expect(first.deduped).toBeUndefined();
    const again = await logExamIncident(subject, s.attemptId, { type: "tab_blur" });
    expect(again).toEqual({ incidentId: first.incidentId, deduped: true });
    for (let i = 0; i < 50; i++) await logExamIncident(subject, s.attemptId, { type: "tab_blur" });
    const rows = await prisma.examIncident.findMany({ where: { attemptId: s.attemptId } });
    expect(rows).toHaveLength(1);
    const events = await prisma.learningEvent.count({
      where: { eventType: LearningEventType.ExamIncidentFlagged, userId: s.learnerId },
    });
    expect(events).toBe(1); // sự cố bị gộp không phát thêm sự kiện
  });

  it("still records a different type right away, and the same type again once the window has passed", async () => {
    const s = await setupInProgress("i3b");
    const subject = { kind: "user", userId: s.learnerId } as const;
    const first = await logExamIncident(subject, s.attemptId, { type: "tab_blur" });
    await logExamIncident(subject, s.attemptId, { type: "paste", payload: { pastedLength: 5 } });
    expect(await prisma.examIncident.count({ where: { attemptId: s.attemptId } })).toBe(2);

    await prisma.examIncident.update({
      where: { id: first.incidentId },
      data: { occurredAt: new Date(Date.now() - INCIDENT_DEDUPE_WINDOW_MS - 1_000) },
    });
    const later = await logExamIncident(subject, s.attemptId, { type: "tab_blur" });
    expect(later.deduped).toBeUndefined();
    expect(later.incidentId).not.toBe(first.incidentId);
    expect(await prisma.examIncident.count({ where: { attemptId: s.attemptId, type: "tab_blur" } })).toBe(2);
  });

  it("rejects when other user attempts to log", async () => {
    const s = await setupInProgress("i4");
    const stranger = await registerUser(
      { email: "stranger-i4@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      logExamIncident({ kind: "user", userId: stranger.userId }, s.attemptId, { type: "tab_blur" }),
    ).rejects.toMatchObject({ code: "attempt_belongs_to_other" });
  });

  it("rejects after submission", async () => {
    const s = await setupInProgress("i5");
    await submitExamAttempt({ kind: "user", userId: s.learnerId }, s.attemptId);
    await expect(
      logExamIncident({ kind: "user", userId: s.learnerId }, s.attemptId, { type: "tab_blur" }),
    ).rejects.toMatchObject({ code: "attempt_already_submitted" });
  });

  it("rejects unknown incident type", async () => {
    const s = await setupInProgress("i6");
    await expect(
      logExamIncident({ kind: "user", userId: s.learnerId }, s.attemptId, { type: "weird_type" }),
    ).rejects.toBeInstanceOf(ExamError);
  });
});

describe("listAttemptIncidents", () => {
  it("returns incidents in chronological order", async () => {
    const s = await setupInProgress("l1");
    const a = await logExamIncident({ kind: "user", userId: s.learnerId }, s.attemptId, { type: "tab_blur" });
    const b = await logExamIncident({ kind: "user", userId: s.learnerId }, s.attemptId, { type: "paste" });
    const list = await listAttemptIncidents(s.attemptId);
    expect(list.map((x) => x.id)).toEqual([a.incidentId, b.incidentId]);
  });
});
