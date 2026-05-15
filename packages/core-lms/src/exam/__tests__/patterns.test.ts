import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  checkPasteFlood,
  checkSpeedRun,
  createExam,
  createExamQuestion,
  evaluateAttemptPatterns,
  MIN_SECONDS_PER_QUESTION,
  PASTE_FLOOD_THRESHOLD,
  PASTE_FLOOD_WINDOW_MS,
  publishExam,
  startExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcqConfig = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setupSubmittedAttempt(slug: string, questionCount: number, elapsedSec: number) {
  const owner = await registerUser(
    { email: `pat-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `pat-${slug}`,
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
  const skill = await prisma.skill.create({ data: { code: `pat.${slug}`, name: "S" } });
  for (let i = 0; i < questionCount; i++) {
    await createExamQuestion(owner.userId, examId, {
      type: "mcq",
      prompt: `Q${i}`,
      config: mcqConfig(),
      points: 1,
      skillIds: [skill.id],
    });
  }
  await publishExam(owner.userId, examId);
  const learner = await registerUser(
    { email: `pat-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const start = await startExamAttempt(learner.userId, examId);
  // Backdate startedAt + set submittedAt to simulate a submission `elapsedSec`s long.
  const submittedAt = new Date();
  const startedAt = new Date(submittedAt.getTime() - elapsedSec * 1000);
  await prisma.examAttempt.update({
    where: { id: start.attemptId },
    data: { startedAt, submittedAt, status: "submitted" },
  });
  return { attemptId: start.attemptId };
}

describe("checkSpeedRun (pure)", () => {
  it("flags when total elapsed < MIN_SECONDS_PER_QUESTION * count", () => {
    const t0 = new Date(0);
    const t1 = new Date(MIN_SECONDS_PER_QUESTION * 5 * 1000 - 1);
    expect(checkSpeedRun(t0, t1, 5)).toBe(true);
  });
  it("does not flag at exactly the threshold", () => {
    const t0 = new Date(0);
    const t1 = new Date(MIN_SECONDS_PER_QUESTION * 5 * 1000);
    expect(checkSpeedRun(t0, t1, 5)).toBe(false);
  });
  it("returns false on zero questions (no data)", () => {
    expect(checkSpeedRun(new Date(0), new Date(100), 0)).toBe(false);
  });
});

describe("checkPasteFlood (pure)", () => {
  const ts = (sec: number) => new Date(sec * 1000);
  it("flags ≥ threshold within a single window", () => {
    expect(checkPasteFlood([ts(0), ts(10), ts(20)])).toBe(true);
  });
  it("does not flag when spaced beyond the window", () => {
    expect(
      checkPasteFlood([
        ts(0),
        ts(PASTE_FLOOD_WINDOW_MS / 1000 + 1),
        ts(2 * (PASTE_FLOOD_WINDOW_MS / 1000) + 2),
      ]),
    ).toBe(false);
  });
  it("flags via sliding window (cluster at end)", () => {
    expect(checkPasteFlood([ts(0), ts(1000), ts(1010), ts(1020)])).toBe(true);
  });
  it("does not flag below threshold", () => {
    expect(checkPasteFlood(Array.from({ length: PASTE_FLOOD_THRESHOLD - 1 }, (_, i) => ts(i)))).toBe(false);
  });
  it("handles unsorted input", () => {
    expect(checkPasteFlood([ts(20), ts(0), ts(10)])).toBe(true);
  });
});

describe("evaluateAttemptPatterns (integration)", () => {
  it("flags speed_run on a too-fast submit", async () => {
    const { attemptId } = await setupSubmittedAttempt("sp1", 5, 30); // 30s / 5 q = 6s/q < 10
    const r = await evaluateAttemptPatterns(attemptId);
    expect(r.flags).toContain("speed_run");
  });

  it("does not flag a plausible submit", async () => {
    const { attemptId } = await setupSubmittedAttempt("sp2", 3, 600); // 200s/q
    const r = await evaluateAttemptPatterns(attemptId);
    expect(r.flags).not.toContain("speed_run");
  });

  it("flags paste_flood when ≥3 paste incidents fit within 60s", async () => {
    const { attemptId } = await setupSubmittedAttempt("pf1", 3, 600);
    const base = Date.now() - 30_000;
    for (let i = 0; i < 3; i++) {
      await prisma.examIncident.create({
        data: { attemptId, type: "paste", occurredAt: new Date(base + i * 1000) },
      });
    }
    const r = await evaluateAttemptPatterns(attemptId);
    expect(r.flags).toContain("paste_flood");
  });

  it("does not flag paste_flood when pastes are spaced out", async () => {
    const { attemptId } = await setupSubmittedAttempt("pf2", 3, 600);
    const base = Date.now() - 5 * 60_000;
    for (let i = 0; i < 3; i++) {
      await prisma.examIncident.create({
        data: { attemptId, type: "paste", occurredAt: new Date(base + i * 90_000) },
      });
    }
    const r = await evaluateAttemptPatterns(attemptId);
    expect(r.flags).not.toContain("paste_flood");
  });

  it("does NOT mutate attempt.status — derived only", async () => {
    const { attemptId } = await setupSubmittedAttempt("imu", 5, 5);
    await evaluateAttemptPatterns(attemptId);
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(a.status).toBe("submitted");
  });

  it("returns empty for non-existent attempt", async () => {
    const r = await evaluateAttemptPatterns("00000000-0000-0000-0000-000000000000");
    expect(r.flags).toEqual([]);
  });
});
