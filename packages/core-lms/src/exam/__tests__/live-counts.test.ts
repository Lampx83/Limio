import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  createExam,
  createExamQuestion,
  ensureDefaultRound,
  liveCountsByRoom,
  liveCountsBySession,
} from "../";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `lc-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `lc-course-${slug}`,
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 20,
  });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: {
      options: [
        { id: "a", label: "A", isCorrect: true },
        { id: "b", label: "B", isCorrect: false },
      ],
    },
    points: 10,
  });
  const roundId = await ensureDefaultRound(examId);
  return { ownerId: owner.userId, examId, roundId };
}

async function mkSession(examId: string, roundId: string) {
  return prisma.examSession.create({
    data: {
      examId,
      roundId,
      opensAt: new Date(),
      closesAt: new Date(Date.now() + 3_600_000),
    },
    select: { id: true },
  });
}

async function mkRoom(examId: string, sessionId: string, proctorUserId: string, n: number) {
  return prisma.examRoom.create({
    data: {
      examId,
      sessionId,
      orderIndex: n,
      name: `P${n}`,
      proctorUserId,
      accessCode: `R${n}${Math.random().toString(36).slice(2, 4)}`.slice(0, 4),
    },
    select: { id: true },
  });
}

async function mkAttempt(
  examId: string,
  sessionId: string,
  roomId: string | null,
  status: "in_progress" | "graded",
) {
  const c = await prisma.examCandidate.create({
    data: {
      examId,
      sessionId,
      roomId,
      displayName: "SV",
      accessCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    select: { id: true },
  });
  await prisma.examAttempt.create({
    data: {
      examId,
      sessionId,
      candidateId: c.id,
      candidateDisplayName: "SV",
      durationSec: 600,
      status,
      ...(status === "graded" ? { submittedAt: new Date() } : {}),
    },
  });
}

describe("liveCountsByRoom", () => {
  it("đếm riêng từng phòng, không cộng dồn", async () => {
    const s = await setup("room");
    const sess = await mkSession(s.examId, s.roundId);
    const p1 = await mkRoom(s.examId, sess.id, s.ownerId, 1);
    const p2 = await mkRoom(s.examId, sess.id, s.ownerId, 2);

    await mkAttempt(s.examId, sess.id, p1.id, "in_progress");
    await mkAttempt(s.examId, sess.id, p1.id, "graded");
    await mkAttempt(s.examId, sess.id, p1.id, "graded");
    await mkAttempt(s.examId, sess.id, p2.id, "in_progress");

    const counts = await liveCountsByRoom(sess.id);
    expect(counts.get(p1.id)).toEqual({
      id: p1.id,
      started: 3,
      submitted: 2,
      inProgress: 1,
    });
    expect(counts.get(p2.id)).toEqual({
      id: p2.id,
      started: 1,
      submitted: 0,
      inProgress: 1,
    });
  });

  it("bài không thuộc phòng nào thì không lọt vào bản đếm", async () => {
    const s = await setup("khongphong");
    const sess = await mkSession(s.examId, s.roundId);
    await mkAttempt(s.examId, sess.id, null, "in_progress");

    const counts = await liveCountsByRoom(sess.id);
    // Thi kiểu ghi danh không xếp phòng — đúng là không thuộc phòng nào.
    expect(counts.size).toBe(0);
  });
});

describe("liveCountsBySession", () => {
  it("đếm riêng từng ca trong đợt", async () => {
    const s = await setup("sess");
    const caA = await mkSession(s.examId, s.roundId);
    const caB = await mkSession(s.examId, s.roundId);
    const pA = await mkRoom(s.examId, caA.id, s.ownerId, 1);

    await mkAttempt(s.examId, caA.id, pA.id, "graded");
    await mkAttempt(s.examId, caA.id, pA.id, "in_progress");
    await mkAttempt(s.examId, caB.id, null, "in_progress");

    const counts = await liveCountsBySession(s.roundId);
    expect(counts.get(caA.id)?.started).toBe(2);
    expect(counts.get(caA.id)?.submitted).toBe(1);
    expect(counts.get(caA.id)?.inProgress).toBe(1);
    // Ca B có bài không thuộc phòng nào — cấp CA vẫn phải đếm được.
    expect(counts.get(caB.id)?.inProgress).toBe(1);
  });
});
