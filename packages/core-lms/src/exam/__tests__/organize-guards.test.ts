import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  createExam,
  createExamQuestion,
  createPassage,
  deleteExam,
  deleteExamSession,
  ensureDefaultSession,
  publishExam,
} from "../";
import { deleteCohort, createCohort } from "../cohorts";
import { removeCandidateFromRoom } from "../exam-rounds";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `og-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `og-course-${slug}`,
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Exam",
    durationMin: 60,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 24 * 60 * 60_000),
  });
  return { ownerId: owner.userId, courseId: course.courseId, examId };
}

async function publishWithQuestion(ownerId: string, examId: string, slug: string) {
  const { passageId } = await createPassage(ownerId, examId, {
    title: "P",
    contentJson: { type: "doc", content: [] },
  });
  const skill = await prisma.skill.create({ data: { code: `og.skill.${slug}`, name: "S" } });
  await createExamQuestion(ownerId, examId, {
    type: "mcq",
    prompt: "Q1",
    config: mcq(),
    passageId,
    skillIds: [skill.id],
  });
  await publishExam(ownerId, examId);
  return ensureDefaultSession(examId);
}

/** Một thí sinh đã có bài làm trong ca. */
async function candidateWithAttempt(examId: string, sessionId: string, cohortId?: string) {
  const cand = await prisma.examCandidate.create({
    data: { examId, sessionId, displayName: "SV", accessCode: "AB12CD34", cohortId },
  });
  await prisma.examAttempt.create({
    data: { examId, candidateId: cand.id, sessionId, durationSec: 3600 },
  });
  return cand;
}

describe("xoá đề / ca / lớp / thí sinh khi đã có bài làm", () => {
  it("deleteExam: đề ARCHIVED còn bài làm cũng không được xoá", async () => {
    const { ownerId, examId } = await setup("del-exam");
    const sessionId = await publishWithQuestion(ownerId, examId, "del-exam");
    await candidateWithAttempt(examId, sessionId);
    await prisma.exam.update({ where: { id: examId }, data: { status: "archived" } });

    await expect(deleteExam(ownerId, examId)).rejects.toMatchObject({
      code: "exam_has_attempts",
    });
    expect(await prisma.examAttempt.count({ where: { examId } })).toBe(1);
  });

  it("deleteExam: đề chưa có bài làm vẫn xoá được", async () => {
    const { ownerId, examId } = await setup("del-exam-ok");
    await deleteExam(ownerId, examId);
    expect(await prisma.exam.findUnique({ where: { id: examId } })).toBeNull();
  });

  it("deleteExamSession: ca có bài làm bị chặn, bài làm và event còn nguyên", async () => {
    const { ownerId, examId } = await setup("del-session");
    const sessionId = await publishWithQuestion(ownerId, examId, "del-session");
    await candidateWithAttempt(examId, sessionId);

    await expect(deleteExamSession(ownerId, sessionId)).rejects.toMatchObject({
      code: "session_has_attempts",
    });
    expect(await prisma.examAttempt.count({ where: { sessionId } })).toBe(1);
    expect(await prisma.examCandidate.count({ where: { sessionId } })).toBe(1);
  });

  it("deleteExamSession: ca chưa có bài làm vẫn xoá được", async () => {
    const { ownerId, examId } = await setup("del-session-ok");
    const sessionId = await publishWithQuestion(ownerId, examId, "del-session-ok");
    await deleteExamSession(ownerId, sessionId);
    expect(await prisma.examSession.findUnique({ where: { id: sessionId } })).toBeNull();
  });

  it("deleteCohort: lớp có thí sinh đã làm bài bị chặn", async () => {
    const { ownerId, courseId, examId } = await setup("del-cohort");
    const sessionId = await publishWithQuestion(ownerId, examId, "del-cohort");
    const { id: cohortId } = await createCohort(ownerId, courseId, { name: "Lớp A" });
    await candidateWithAttempt(examId, sessionId, cohortId);

    await expect(deleteCohort(ownerId, cohortId)).rejects.toMatchObject({
      code: "cohort_has_attempts",
    });
    expect(await prisma.examAttempt.count({ where: { examId } })).toBe(1);
  });

  it("removeCandidateFromRoom: thí sinh đã có bài làm bị chặn", async () => {
    const { ownerId, examId } = await setup("rm-cand");
    const sessionId = await publishWithQuestion(ownerId, examId, "rm-cand");
    const session = await prisma.examSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { roundId: true },
    });
    await prisma.examRoundAdmin.create({
      data: { roundId: session.roundId, userId: ownerId },
    });
    const room = await prisma.examRoom.create({
      data: { examId, sessionId, orderIndex: 0, name: "P1", proctorUserId: ownerId },
    });
    const cand = await candidateWithAttempt(examId, sessionId);
    await prisma.examCandidate.update({ where: { id: cand.id }, data: { roomId: room.id } });

    await expect(removeCandidateFromRoom(ownerId, cand.id)).rejects.toMatchObject({
      code: "candidate_has_attempts",
    });
    expect(await prisma.examAttempt.count({ where: { candidateId: cand.id } })).toBe(1);
  });
});

describe("publishExam — section ngẫu nhiên chưa chốt", () => {
  it("từ chối publish và nói rõ phải chốt", async () => {
    const { ownerId, examId } = await setup("pub-random");
    await prisma.examSection.create({
      data: {
        examId,
        title: "Câu hỏi",
        orderIndex: 0,
        selectionMode: "random_from_bank",
        resolutionMode: "per_attempt",
        poolFilter: { bankIds: [], count: 5, pointsPerItem: 1 },
      },
    });
    await expect(publishExam(ownerId, examId)).rejects.toMatchObject({
      code: "exam_not_publishable",
      details: { errors: [expect.stringContaining("chốt")] },
    });
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(e.status).toBe("draft");
  });
});
