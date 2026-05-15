// A5.3 PR1a — Schema-level smoke tests for the new ExamRound / ExamSession /
// ExamRoom additive columns. These don't exercise any business logic (none
// exists yet — services land in PR1b/PR1c). Goal: prove the new schema is
// reachable from the Prisma client and the new FKs behave (cascade/restrict).
import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { createExamRoom } from "../exam-rooms";

const BASE = "http://localhost:3000";

async function newOwnerAndCourse(slug: string) {
  const u = await registerUser(
    { email: `er-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const c = await createCourse(u.userId, {
    title: `Round course ${slug}`,
    description: "x",
    slug: `round-course-${slug}`,
  });
  return { ownerId: u.userId, courseId: c.courseId };
}

// Convenience: an exam + a round (bridged to course) + 1 session in that round.
// Most PR1b tests need this baseline because sessionId on Room/Candidate is
// now NOT NULL.
async function newExamWithSession(slug: string) {
  const { ownerId, courseId } = await newOwnerAndCourse(slug);
  const exam = await prisma.exam.create({
    data: {
      courseId,
      title: `Exam ${slug}`,
      durationMin: 60,
      openAt: new Date(),
      closeAt: new Date(Date.now() + 60_000),
    },
  });
  const round = await prisma.examRound.create({
    data: {
      code: `RND-${slug}-${Date.now()}`,
      title: `Đợt ${slug}`,
      opensAt: new Date(),
      closesAt: new Date(Date.now() + 60_000),
      courseId,
    },
  });
  const session = await prisma.examSession.create({
    data: {
      examId: exam.id,
      roundId: round.id,
      code: "CA-1",
      title: "Ca 1",
      opensAt: new Date(),
      closesAt: new Date(Date.now() + 60_000),
    },
  });
  return { ownerId, courseId, exam, round, session };
}

describe("A5.3 PR2.11 — ExamRound (1 course per round)", () => {
  it("creates ExamRound bound to 1 course", async () => {
    const { courseId } = await newOwnerAndCourse(
      `bind-${Date.now().toString(36)}`,
    );
    const code = `RND-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const r = await prisma.examRound.create({
      data: {
        code,
        title: "Đợt thi cuối kỳ — test",
        opensAt: new Date(Date.now() + 60_000),
        closesAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        courseId,
      },
    });
    expect(r.status).toBe("draft");
    expect(r.courseId).toBe(courseId);
  });

  it("rejects duplicate ExamRound.code within same course", async () => {
    const { courseId } = await newOwnerAndCourse(
      `dup-${Date.now().toString(36)}`,
    );
    const code = `RND-DUP-${Date.now()}`;
    await prisma.examRound.create({
      data: {
        code,
        title: "First",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 60_000),
        courseId,
      },
    });
    await expect(
      prisma.examRound.create({
        data: {
          code,
          title: "Second",
          opensAt: new Date(),
          closesAt: new Date(Date.now() + 60_000),
          courseId,
        },
      }),
    ).rejects.toThrow();
  });

  it("ExamRoundAdmin allows multiple admins per round", async () => {
    const { courseId } = await newOwnerAndCourse(
      `multi-adm-${Date.now().toString(36)}`,
    );
    const u1 = await registerUser(
      { email: `ra1-${Date.now()}@e.com`, password: "password1234", displayName: "A1" },
      BASE,
    );
    const u2 = await registerUser(
      { email: `ra2-${Date.now()}@e.com`, password: "password1234", displayName: "A2" },
      BASE,
    );
    const round = await prisma.examRound.create({
      data: {
        code: `RND-ADM-${Date.now()}`,
        title: "Admin test",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 60_000),
        courseId,
        admins: {
          create: [
            { userId: u1.userId, grantedBy: u1.userId },
            { userId: u2.userId, grantedBy: u1.userId },
          ],
        },
      },
      include: { admins: true },
    });
    expect(round.admins).toHaveLength(2);
  });

  it("cascade-deletes ExamRoundAdmin when round is deleted", async () => {
    const { courseId } = await newOwnerAndCourse(`rcas-${Date.now().toString(36)}`);
    const u = await registerUser(
      { email: `rcas-${Date.now()}@e.com`, password: "password1234", displayName: "U" },
      BASE,
    );
    const round = await prisma.examRound.create({
      data: {
        code: `RND-CAS-${Date.now()}`,
        title: "Cascade",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 60_000),
        courseId,
        admins: { create: [{ userId: u.userId }] },
      },
    });
    await prisma.examRound.delete({ where: { id: round.id } });
    expect(
      await prisma.examRoundAdmin.findMany({ where: { roundId: round.id } }),
    ).toEqual([]);
  });
});

describe("A5.3 — ExamSession (Prisma model renamed from ExamSchedule in PR1c.1)", () => {
  it("allows setting roundId on a schedule (nullable in PR1a)", async () => {
    const { ownerId, courseId } = await newOwnerAndCourse(
      `sched-${Date.now().toString(36)}`,
    );
    const exam = await prisma.exam.create({
      data: {
        courseId,
        title: "Exam for session",
        durationMin: 60,
        openAt: new Date(),
        closeAt: new Date(Date.now() + 60_000),
      },
    });
    const round = await prisma.examRound.create({
      data: {
        code: `RND-SES-${Date.now()}`,
        title: "Round w session",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 60_000),
        courseId,
      },
    });
    const session = await prisma.examSession.create({
      data: {
        examId: exam.id,
        roundId: round.id,
        code: "CA-1",
        title: "Ca 1",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 60_000),
      },
    });
    expect(session.roundId).toBe(round.id);
    expect(session.status).toBe("draft");
    expect(session.code).toBe("CA-1");
    // Use ownerId to silence unused-binding lint if/when added.
    expect(ownerId).toBeTruthy();
  });

  it("rejects ExamSession without roundId (PR1c.5 NOT NULL)", async () => {
    const { courseId } = await newOwnerAndCourse(`bc-${Date.now().toString(36)}`);
    const exam = await prisma.exam.create({
      data: {
        courseId,
        title: "Legacy exam",
        durationMin: 60,
        openAt: new Date(),
        closeAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(
      prisma.examSession.create({
        data: {
          examId: exam.id,
          opensAt: new Date(),
          closesAt: new Date(Date.now() + 60_000),
        } as never,
      }),
    ).rejects.toThrow();
  });

  it("RESTRICT prevents deleting a round that still has sessions", async () => {
    const { courseId } = await newOwnerAndCourse(`rdel-${Date.now().toString(36)}`);
    const exam = await prisma.exam.create({
      data: {
        courseId,
        title: "E",
        durationMin: 60,
        openAt: new Date(),
        closeAt: new Date(Date.now() + 60_000),
      },
    });
    const round = await prisma.examRound.create({
      data: {
        code: `RND-RST-${Date.now()}`,
        title: "Restrict",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 60_000),
        courseId,
      },
    });
    await prisma.examSession.create({
      data: {
        examId: exam.id,
        roundId: round.id,
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(
      prisma.examRound.delete({ where: { id: round.id } }),
    ).rejects.toThrow();
  });
});

describe("A5.3 PR1a — ExamRoom / ExamCandidate additive columns", () => {
  it("creates ExamRoom with required sessionId + orderIndex (PR1b)", async () => {
    const { ownerId, exam, session } = await newExamWithSession(
      `rm-${Date.now().toString(36)}`,
    );
    const room = await prisma.examRoom.create({
      data: {
        examId: exam.id,
        sessionId: session.id,
        orderIndex: 1,
        name: "A101",
        proctorUserId: ownerId,
      },
    });
    expect(room.sessionId).toBe(session.id);
    expect(room.orderIndex).toBe(1);
  });

  it("rejects ExamRoom without sessionId/orderIndex (PR1c.3 NOT NULL)", async () => {
    const { ownerId, exam } = await newExamWithSession(
      `rmn-${Date.now().toString(36)}`,
    );
    await expect(
      prisma.examRoom.create({
        data: {
          examId: exam.id,
          name: "Legacy room",
          proctorUserId: ownerId,
        } as never,
      }),
    ).rejects.toThrow();
  });

  it("cascade-deletes rooms when their session is deleted", async () => {
    const { ownerId, exam, session } = await newExamWithSession(
      `rmc-${Date.now().toString(36)}`,
    );
    const room = await prisma.examRoom.create({
      data: {
        examId: exam.id,
        sessionId: session.id,
        orderIndex: 1,
        name: "A102",
        proctorUserId: ownerId,
      },
    });
    await prisma.examSession.delete({ where: { id: session.id } });
    expect(
      await prisma.examRoom.findUnique({ where: { id: room.id } }),
    ).toBeNull();
  });

  it("ExamCandidate requires sessionId; userId optional (PR1b)", async () => {
    const { exam, session } = await newExamWithSession(
      `cand-${Date.now().toString(36)}`,
    );
    const candUser = await registerUser(
      {
        email: `cand-${Date.now()}@e.com`,
        password: "password1234",
        displayName: "C",
      },
      BASE,
    );
    const cand = await prisma.examCandidate.create({
      data: {
        examId: exam.id,
        sessionId: session.id,
        userId: candUser.userId,
        displayName: "Thí sinh A",
      },
    });
    expect(cand.sessionId).toBe(session.id);
    expect(cand.userId).toBe(candUser.userId);
  });

  it("candidate.userId becomes null when linked user is deleted (SetNull)", async () => {
    const { exam, session } = await newExamWithSession(
      `cdu-${Date.now().toString(36)}`,
    );
    const u = await registerUser(
      {
        email: `cdu-${Date.now()}@e.com`,
        password: "password1234",
        displayName: "U",
      },
      BASE,
    );
    const cand = await prisma.examCandidate.create({
      data: {
        examId: exam.id,
        sessionId: session.id,
        userId: u.userId,
        displayName: "X",
      },
    });
    await prisma.user.delete({ where: { id: u.userId } });
    const after = await prisma.examCandidate.findUnique({
      where: { id: cand.id },
    });
    expect(after?.userId).toBeNull();
  });
});

describe("A5.3 PR1c.3 — createExamRoom auto session + orderIndex", () => {
  it("creates default ExamSession+ExamRound for exam with no session, sets orderIndex=1", async () => {
    const owner = await registerUser(
      {
        email: `crm-${Date.now()}@e.com`,
        password: "password1234",
        displayName: "O",
      },
      BASE,
    );
    const c = await createCourse(owner.userId, {
      title: `T ${Date.now()}`,
      description: "x",
      slug: `crm-${Date.now().toString(36)}`,
    });
    const exam = await prisma.exam.create({
      data: {
        courseId: c.courseId,
        title: "T",
        durationMin: 60,
        openAt: new Date(),
        closeAt: new Date(Date.now() + 60_000),
      },
    });

    const { id: roomId } = await createExamRoom(owner.userId, exam.id, {
      name: "A101",
      proctorUserId: owner.userId,
    });
    const room = await prisma.examRoom.findUniqueOrThrow({
      where: { id: roomId },
      include: { session: { include: { round: true } } },
    });
    expect(room.sessionId).not.toBeNull();
    expect(room.orderIndex).toBe(1);
    expect(room.session.code).toBe("CA-DEFAULT");
    expect(room.session.roundId).not.toBeNull();
    expect(room.session.round?.code.startsWith("AUTO-EXAM-")).toBe(true);
  });

  it("reuses existing session + increments orderIndex on subsequent rooms", async () => {
    const owner = await registerUser(
      {
        email: `crm2-${Date.now()}@e.com`,
        password: "password1234",
        displayName: "O",
      },
      BASE,
    );
    const c = await createCourse(owner.userId, {
      title: `T2 ${Date.now()}`,
      description: "x",
      slug: `crm2-${Date.now().toString(36)}`,
    });
    const exam = await prisma.exam.create({
      data: {
        courseId: c.courseId,
        title: "T2",
        durationMin: 60,
        openAt: new Date(),
        closeAt: new Date(Date.now() + 60_000),
      },
    });

    const r1 = await createExamRoom(owner.userId, exam.id, {
      name: "A101",
      proctorUserId: owner.userId,
    });
    const r2 = await createExamRoom(owner.userId, exam.id, {
      name: "A102",
      proctorUserId: owner.userId,
    });
    const rooms = await prisma.examRoom.findMany({
      where: { id: { in: [r1.id, r2.id] } },
      orderBy: { orderIndex: "asc" },
    });
    expect(rooms.map((r) => r.orderIndex)).toEqual([1, 2]);
    expect(rooms[0]!.sessionId).toBe(rooms[1]!.sessionId);
  });
});
