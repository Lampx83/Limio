import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  closeOralExamSession,
  createExam,
  createOralMaterialTopicList,
  deleteOralAttempt,
  ExamError,
  joinOralSessionByCode,
  openOralExamSession,
  publishExam,
  resolveOralJoinCode,
  startOralExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

async function publishedOralExamSetup(slug: string, durationMin = 20) {
  const owner = await registerUser(
    { email: `oa-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `oa-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Vấn đáp",
    durationMin,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  await createOralMaterialTopicList(owner.userId, examId, {
    title: "Chủ đề",
    text: "Vòng lặp, đệ quy.",
  });
  await publishExam(owner.userId, examId);

  const learner = await registerUser(
    { email: `oa-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  return { ownerId: owner.userId, courseId: course.courseId, examId, learnerId: learner.userId };
}

describe("startOralExamAttempt (A6.3)", () => {
  it("creates an in_progress attempt and emits exam.started", async () => {
    const s = await publishedOralExamSetup("s1", 20);
    const r = await startOralExamAttempt(s.learnerId, s.examId);
    expect(r.resumed).toBe(false);
    expect(r.durationSec).toBe(20 * 60);

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    expect(attempt.status).toBe("in_progress");
    expect(attempt.userId).toBe(s.learnerId);

    const ev = await prisma.learningEvent.findFirst({
      where: { eventType: LearningEventType.ExamStarted, userId: s.learnerId },
    });
    expect(ev).not.toBeNull();
  });

  it("resumes the same in_progress attempt on a second call", async () => {
    const s = await publishedOralExamSetup("s2");
    const first = await startOralExamAttempt(s.learnerId, s.examId);
    const second = await startOralExamAttempt(s.learnerId, s.examId);
    expect(second.resumed).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
  });

  it("rejects a learner who is not enrolled", async () => {
    const s = await publishedOralExamSetup("s3");
    const outsider = await registerUser(
      { email: "oa-outsider-s3@e.com", password: "password1234", displayName: "U" },
      BASE,
    );
    await expect(startOralExamAttempt(outsider.userId, s.examId)).rejects.toMatchObject({
      code: "not_enrolled",
    });
  });

  it("rejects a written exam with exam_not_oral", async () => {
    const owner = await registerUser(
      { email: "oa-owner-s4@e.com", password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: "C s4",
      description: "x",
      slug: "oa-course-s4",
    });
    const { examId } = await createExam(owner.userId, course.courseId, {
      title: "Written",
      durationMin: 20,
    });
    await expect(startOralExamAttempt(owner.userId, examId)).rejects.toMatchObject({
      code: "exam_not_oral",
    });
  });

  it("rejects starting again once the attempt is already submitted", async () => {
    const s = await publishedOralExamSetup("s5");
    const first = await startOralExamAttempt(s.learnerId, s.examId);
    await prisma.examAttempt.update({
      where: { id: first.attemptId },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await expect(startOralExamAttempt(s.learnerId, s.examId)).rejects.toMatchObject({
      code: "attempt_already_submitted",
    });
  });
});

describe("openOralExamSession / closeOralExamSession (A6.5 rewrite)", () => {
  async function draftOralExamSetup(slug: string, opts: { withMaterial?: boolean } = {}) {
    const owner = await registerUser(
      { email: `os-o-${slug}@e.com`, password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: `Course ${slug}`,
      description: "x",
      slug: `os-course-${slug}`,
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
    if (opts.withMaterial !== false) {
      await createOralMaterialTopicList(owner.userId, examId, {
        title: "Chủ đề",
        text: "Vòng lặp, đệ quy.",
      });
    }
    const learner = await registerUser(
      { email: `os-l-${slug}@e.com`, password: "password1234", displayName: "L" },
      BASE,
    );
    await enrollInCourse(learner.userId, course.courseId);
    return { ownerId: owner.userId, courseId: course.courseId, examId, learnerId: learner.userId };
  }

  it("publishes a draft exam and opens exactly one manual, code-free session", async () => {
    const s = await draftOralExamSetup("open1");
    const r = await openOralExamSession(s.ownerId, s.examId);
    expect(r.published).toBe(true);
    expect(r.reused).toBe(false);

    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } });
    expect(exam.status).toBe("published");

    const sessions = await prisma.examSession.findMany({ where: { examId: s.examId } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe(r.sessionId);
    expect(sessions[0]!.timingMode).toBe("manual");
    expect(sessions[0]!.status).toBe("open");
    expect(sessions[0]!.accessMode).toBe("authenticated");
    expect(sessions[0]!.openCode).toBeNull();

    // Học viên vào được ngay, không cần mã.
    const attempt = await startOralExamAttempt(s.learnerId, s.examId);
    expect(attempt.resumed).toBe(false);
  });

  it("is idempotent — calling again reuses the same session, no duplicate created", async () => {
    const s = await draftOralExamSetup("open2");
    const first = await openOralExamSession(s.ownerId, s.examId);
    const second = await openOralExamSession(s.ownerId, s.examId);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.reused).toBe(true);
    expect(second.published).toBe(false);

    const count = await prisma.examSession.count({ where: { examId: s.examId } });
    expect(count).toBe(1);
  });

  it("accepts a durationOverrideMin and uses it instead of the exam's default duration", async () => {
    const s = await draftOralExamSetup("dur1"); // draftOralExamSetup's exam durationMin default (20) đã set qua publishedOralExamSetup
    await openOralExamSession(s.ownerId, s.examId, { durationOverrideMin: 45 });
    const session = await prisma.examSession.findFirstOrThrow({ where: { examId: s.examId } });
    expect(session.durationOverrideMin).toBe(45);

    const attempt = await startOralExamAttempt(s.learnerId, s.examId);
    expect(attempt.durationSec).toBe(45 * 60);
  });

  it("lets the instructor change durationOverrideMin on an already-open session without closing it", async () => {
    const s = await draftOralExamSetup("dur2");
    const first = await openOralExamSession(s.ownerId, s.examId, { durationOverrideMin: 30 });
    const second = await openOralExamSession(s.ownerId, s.examId, { durationOverrideMin: 90 });
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.reused).toBe(true);
    const session = await prisma.examSession.findFirstOrThrow({ where: { examId: s.examId } });
    expect(session.durationOverrideMin).toBe(90);
    expect(session.status).toBe("open");
  });

  it("rejects a non-positive or too-large durationOverrideMin", async () => {
    const s = await draftOralExamSetup("dur3");
    await expect(
      openOralExamSession(s.ownerId, s.examId, { durationOverrideMin: 0 }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      openOralExamSession(s.ownerId, s.examId, { durationOverrideMin: 25 * 60 }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("rejects a draft exam with no materials, without publishing it", async () => {
    const s = await draftOralExamSetup("empty", { withMaterial: false });
    await expect(openOralExamSession(s.ownerId, s.examId)).rejects.toMatchObject({
      code: "exam_not_publishable",
    });
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } });
    expect(exam.status).toBe("draft");
  });

  it("rejects a written exam", async () => {
    const owner = await registerUser(
      { email: "os-owner-written@e.com", password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: "C written",
      description: "x",
      slug: "os-course-written",
    });
    const { examId } = await createExam(owner.userId, course.courseId, {
      title: "Written",
      durationMin: 20,
    });
    await expect(openOralExamSession(owner.userId, examId)).rejects.toMatchObject({
      code: "exam_not_oral",
    });
  });

  it("closeOralExamSession blocks new attempts but not the one in progress", async () => {
    const s = await draftOralExamSetup("close1");
    await openOralExamSession(s.ownerId, s.examId);
    const attempt = await startOralExamAttempt(s.learnerId, s.examId);

    await closeOralExamSession(s.ownerId, s.examId);
    const session = await prisma.examSession.findFirstOrThrow({ where: { examId: s.examId } });
    expect(session.status).toBe("closed");
    expect(session.closedById).toBe(s.ownerId);

    // Bài đang làm dở không bị đụng tới.
    const stillInProgress = await prisma.examAttempt.findUniqueOrThrow({
      where: { id: attempt.attemptId },
    });
    expect(stillInProgress.status).toBe("in_progress");

    // Chỉ MỘT ca chi phối cả đề (không có ca mặc định thứ hai âm thầm còn mở
    // — điểm khác biệt với thi viết) nên đóng ca này là chặn được thật.
    const outsider = await registerUser(
      { email: "os-outsider-close1@e.com", password: "password1234", displayName: "U2" },
      BASE,
    );
    await enrollInCourse(outsider.userId, s.courseId);
    await expect(startOralExamAttempt(outsider.userId, s.examId)).rejects.toMatchObject({
      code: "exam_window_closed",
    });
  });

  it("reopening after close reuses the same session row", async () => {
    const s = await draftOralExamSetup("reopen1");
    const first = await openOralExamSession(s.ownerId, s.examId);
    await closeOralExamSession(s.ownerId, s.examId);
    const second = await openOralExamSession(s.ownerId, s.examId);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.published).toBe(false);

    const count = await prisma.examSession.count({ where: { examId: s.examId } });
    expect(count).toBe(1);

    const attempt = await startOralExamAttempt(s.learnerId, s.examId);
    expect(attempt.resumed).toBe(false);
  });

  it("keeps the same join code across close/reopen", async () => {
    const s = await draftOralExamSetup("stablecode1");
    const first = await openOralExamSession(s.ownerId, s.examId);
    await closeOralExamSession(s.ownerId, s.examId);
    const second = await openOralExamSession(s.ownerId, s.examId);
    expect(second.joinCode).toBe(first.joinCode);
  });
});

describe("joinOralSessionByCode / resolveOralJoinCode (A6.5 rewrite)", () => {
  async function draftOralExamSetup(slug: string) {
    const owner = await registerUser(
      { email: `jc-o-${slug}@e.com`, password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: `Course ${slug}`,
      description: "x",
      slug: `jc-course-${slug}`,
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
    await createOralMaterialTopicList(owner.userId, examId, {
      title: "Chủ đề",
      text: "Vòng lặp, đệ quy.",
    });
    return { ownerId: owner.userId, examId };
  }

  it("lets a logged-in user who is NOT enrolled join by code", async () => {
    const s = await draftOralExamSetup("basic1");
    const { joinCode } = await openOralExamSession(s.ownerId, s.examId);

    const stranger = await registerUser(
      { email: "jc-stranger-basic1@e.com", password: "password1234", displayName: "U" },
      BASE,
    );
    // Không enrollInCourse — đúng điểm mà đường này khác startOralExamAttempt.
    const info = await resolveOralJoinCode(joinCode);
    expect(info?.examId).toBe(s.examId);
    expect(info?.isOpen).toBe(true);

    const r = await joinOralSessionByCode(stranger.userId, joinCode);
    expect(r.resumed).toBe(false);
    expect(r.examId).toBe(s.examId);

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    expect(attempt.userId).toBe(stranger.userId);
    expect(attempt.status).toBe("in_progress");
  });

  it("resumes the same attempt on a second join", async () => {
    const s = await draftOralExamSetup("resume1");
    const { joinCode } = await openOralExamSession(s.ownerId, s.examId);
    const stranger = await registerUser(
      { email: "jc-stranger-resume1@e.com", password: "password1234", displayName: "U" },
      BASE,
    );
    const first = await joinOralSessionByCode(stranger.userId, joinCode);
    const second = await joinOralSessionByCode(stranger.userId, joinCode);
    expect(second.resumed).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);
  });

  it("rejects an unknown code", async () => {
    await expect(joinOralSessionByCode("does-not-matter", "ZZZZZZ")).rejects.toMatchObject({
      code: "invalid_code",
    });
    expect(await resolveOralJoinCode("ZZZZZZ")).toBeNull();
  });

  it("rejects once the session is closed", async () => {
    const s = await draftOralExamSetup("closed1");
    const { joinCode } = await openOralExamSession(s.ownerId, s.examId);
    await closeOralExamSession(s.ownerId, s.examId);

    const info = await resolveOralJoinCode(joinCode);
    expect(info?.isOpen).toBe(false);

    const stranger = await registerUser(
      { email: "jc-stranger-closed1@e.com", password: "password1234", displayName: "U" },
      BASE,
    );
    await expect(joinOralSessionByCode(stranger.userId, joinCode)).rejects.toMatchObject({
      code: "exam_window_closed",
    });
  });

  it("does not create a duplicate attempt for a user who already joined via the course page", async () => {
    const s = await draftOralExamSetup("dup1");
    const { joinCode } = await openOralExamSession(s.ownerId, s.examId);
    const learner = await registerUser(
      { email: "jc-learner-dup1@e.com", password: "password1234", displayName: "L" },
      BASE,
    );
    await enrollInCourse(learner.userId, (await prisma.course.findFirstOrThrow({
      where: { exams: { some: { id: s.examId } } },
      select: { id: true },
    })).id);
    const viaCourse = await startOralExamAttempt(learner.userId, s.examId);
    const viaCode = await joinOralSessionByCode(learner.userId, joinCode);
    expect(viaCode.resumed).toBe(true);
    expect(viaCode.attemptId).toBe(viaCourse.attemptId);
  });

  it("đề độc lập (courseId=null) — resolveOralJoinCode trả courseTitle null thay vì throw", async () => {
    const { grantRole } = await import("../../auth/roles");
    const owner = await registerUser(
      { email: "jc-o-noexam@e.com", password: "password1234", displayName: "O" },
      BASE,
    );
    await grantRole(owner.userId, { targetUserId: owner.userId, roleName: "instructor" });
    const now = Date.now();
    const { examId } = await createExam(owner.userId, null, {
      title: "Vấn đáp độc lập",
      durationMin: 20,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 7 * 24 * 60 * 60_000),
      kind: "oral",
    });
    await createOralMaterialTopicList(owner.userId, examId, { title: "Chủ đề", text: "x" });
    const { joinCode } = await openOralExamSession(owner.userId, examId);

    const info = await resolveOralJoinCode(joinCode);
    expect(info?.examId).toBe(examId);
    expect(info?.courseTitle).toBeNull();
    expect(info?.courseSlug).toBeNull();

    const stranger = await registerUser(
      { email: "jc-stranger-noexam@e.com", password: "password1234", displayName: "U" },
      BASE,
    );
    const r = await joinOralSessionByCode(stranger.userId, joinCode);
    expect(r.examId).toBe(examId);
  });
});

describe("deleteOralAttempt (A6.5 rewrite)", () => {
  it("lets the instructor delete a stuck/test attempt, cascading its turns", async () => {
    const s = await publishedOralExamSetup("del1");
    const { attemptId } = await startOralExamAttempt(s.learnerId, s.examId);
    await prisma.oralExamTurn.create({
      data: { attemptId, role: "examiner", content: "Q1" },
    });

    await deleteOralAttempt(s.ownerId, attemptId);

    expect(await prisma.examAttempt.findUnique({ where: { id: attemptId } })).toBeNull();
    expect(await prisma.oralExamTurn.count({ where: { attemptId } })).toBe(0);
  });

  it("rejects a learner who is not an instructor of the course", async () => {
    const s = await publishedOralExamSetup("del2");
    const { attemptId } = await startOralExamAttempt(s.learnerId, s.examId);
    await expect(deleteOralAttempt(s.learnerId, attemptId)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(await prisma.examAttempt.findUnique({ where: { id: attemptId } })).not.toBeNull();
  });

  it("rejects a written exam's attempt", async () => {
    const owner = await registerUser(
      { email: "del-owner-written@e.com", password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: "C written del",
      description: "x",
      slug: "del-course-written",
    });
    const { examId } = await createExam(owner.userId, course.courseId, {
      title: "Written",
      durationMin: 20,
    });
    const attempt = await prisma.examAttempt.create({
      data: { examId, userId: owner.userId, durationSec: 1200, sessionToken: "tok-del" },
    });
    await expect(deleteOralAttempt(owner.userId, attempt.id)).rejects.toMatchObject({
      code: "exam_not_oral",
    });
  });

  it("rejects an unknown attempt id", async () => {
    const s = await publishedOralExamSetup("del3");
    await expect(
      deleteOralAttempt(s.ownerId, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toMatchObject({ code: "attempt_not_found" });
  });
});
