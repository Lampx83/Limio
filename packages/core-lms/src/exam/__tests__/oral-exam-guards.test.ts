import { describe, expect, it, vi } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import {
  addCandidatesToRoom,
  applyAutoGradingForAttempt,
  bulkCreateExamSessionsInRound,
  createExam,
  createExamQuestion,
  createExamRound,
  createOralMaterialTopicList,
  disqualifyAttempt,
  extendAttempt,
  forceSubmitAttemptMarkOnly,
  gradeStuckSubmittedAttempts,
  publishExam,
  startExamAttempt,
  startOralExamAttempt,
} from "../";
import { openForEnrolled } from "../../test/openForEnrolled";

const BASE = "http://localhost:3000";

// A6.5 audit — "Tổ chức thi chính thức"/live-attempt/auto-grade đều là hạ
// tầng THI VIẾT và không hề biết tới exam.kind trước khi vá. Bug thật đã xảy
// ra trên production: mở ca vấn đáp qua "Link thi nhanh" sinh ra link mã dự
// thi kiểu thi viết, dẫn thẳng vào ExamPlayer (0 câu hỏi). Bộ test này khoá
// lại các đường vào đã vá — không phải hành vi mới, mà là RÀO CHẮN.
async function setupOral(slug: string) {
  const owner = await registerUser(
    { email: `oeg-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `oeg-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Vấn đáp ${slug}`,
    durationMin: 20,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    kind: "oral",
  });
  await createOralMaterialTopicList(owner.userId, examId, { title: "Chủ đề", text: "x" });
  await publishExam(owner.userId, examId);
  await openForEnrolled(owner.userId, examId);

  const learner = await registerUser(
    { email: `oeg-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);

  return { ownerId: owner.userId, courseId: course.courseId, examId, learnerId: learner.userId };
}

describe("Guard: hành động chấm/gia hạn của thi viết từ chối đề vấn đáp AI", () => {
  it("forceSubmitAttemptMarkOnly từ chối — tránh vòng auto-grade 0/0 câu hỏi", async () => {
    const s = await setupOral("fs1");
    const { attemptId } = await startOralExamAttempt(s.learnerId, s.examId);

    await expect(
      forceSubmitAttemptMarkOnly(s.ownerId, attemptId, "test"),
    ).rejects.toMatchObject({ code: "exam_not_written" });

    // Không bị đổi trạng thái — vẫn đang thi bình thường.
    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt.status).toBe("in_progress");
  });

  it("disqualifyAttempt từ chối", async () => {
    const s = await setupOral("dq1");
    const { attemptId } = await startOralExamAttempt(s.learnerId, s.examId);

    await expect(
      disqualifyAttempt(s.ownerId, attemptId, "test"),
    ).rejects.toMatchObject({ code: "exam_not_written" });
  });

  it("extendAttempt từ chối", async () => {
    const s = await setupOral("ext1");
    const { attemptId } = await startOralExamAttempt(s.learnerId, s.examId);

    await expect(
      extendAttempt(s.ownerId, attemptId, 10),
    ).rejects.toMatchObject({ code: "exam_not_written" });
  });
});

describe("Guard: applyAutoGradingForAttempt từ chối đề vấn đáp AI", () => {
  it("không âm thầm ghi score=0/graded khi attempt vấn đáp đã submitted", async () => {
    const s = await setupOral("ag1");
    const { attemptId } = await startOralExamAttempt(s.learnerId, s.examId);
    // Mô phỏng trạng thái sau khi runOralExamTurn tự đóng buổi (hết giờ/đủ câu).
    await prisma.examAttempt.update({ where: { id: attemptId }, data: { status: "submitted" } });

    await expect(applyAutoGradingForAttempt(attemptId)).rejects.toMatchObject({
      code: "exam_not_written",
    });

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt.status).toBe("submitted");
    expect(attempt.score).toBeNull();
    expect(attempt.scorePct).toBeNull();
  });
});

describe("Guard: cron gỡ kẹt (gradeStuckSubmittedAttempts) bỏ qua đề vấn đáp AI", () => {
  // Lượt vấn đáp đã nộp ở "submitted" + score=null là trạng thái BÌNH THƯỜNG
  // (chờ GV chốt điểm ở tab Chấm bài), không phải bài kẹt. Trước khi vá, cron
  // nhặt chúng mỗi lượt, applyAutoGradingForAttempt ném exam_not_written, rồi
  // lượt sau nhặt lại — prod 26/11/2026: ~2.000 dòng lỗi/giờ/replica, và 100
  // lượt vấn đáp chiếm hết `take` nên bài thi viết kẹt thật không tới lượt.
  it("không nhặt lượt vấn đáp đã nộp, không ghi lỗi, không đổi lượt đó", async () => {
    const s = await setupOral("st1");
    const { attemptId } = await startOralExamAttempt(s.learnerId, s.examId);
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { status: "submitted", submittedAt: new Date(Date.now() - 3_600_000) },
    });

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await gradeStuckSubmittedAttempts(prisma, { graceMs: 0, batchSize: 1000 });
      expect(r.attemptIds).not.toContain(attemptId);
      const logged = errSpy.mock.calls.some((c) => String(c[0]).includes(attemptId));
      expect(logged).toBe(false);
    } finally {
      errSpy.mockRestore();
    }

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt).toMatchObject({ status: "submitted", score: null, scorePct: null, gradedAt: null });
  });

  it("lượt vấn đáp cũ hơn không chiếm chỗ của bài thi viết kẹt thật (batchSize nhỏ)", async () => {
    const s = await setupOral("st2");
    const oral = await startOralExamAttempt(s.learnerId, s.examId);
    await prisma.examAttempt.update({
      where: { id: oral.attemptId },
      data: { status: "submitted", submittedAt: new Date(Date.now() - 2 * 3_600_000) },
    });

    // Đề viết cùng khoá, 1 câu trắc nghiệm; bài "kẹt" = đã nộp mà worker chưa chấm.
    const now = Date.now();
    const { examId: writtenId } = await createExam(s.ownerId, s.courseId, {
      title: "Viết st2",
      durationMin: 20,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    });
    const skill = await prisma.skill.create({ data: { code: "oeg.st2", name: "S" } });
    await createExamQuestion(s.ownerId, writtenId, {
      type: "mcq",
      prompt: "Q1",
      config: {
        options: [
          { id: "a", label: "A", isCorrect: true },
          { id: "b", label: "B", isCorrect: false },
        ],
      },
      points: 5,
      skillIds: [skill.id],
    });
    await publishExam(s.ownerId, writtenId);
    await openForEnrolled(s.ownerId, writtenId);
    const written = await startExamAttempt(s.learnerId, writtenId);
    await prisma.examAttempt.update({
      where: { id: written.attemptId },
      data: { status: "submitted", submittedAt: new Date(Date.now() - 3_600_000) },
    });

    const r = await gradeStuckSubmittedAttempts(prisma, { graceMs: 0, batchSize: 1 });
    expect(r.errors).toBe(0);
    expect(r.attemptIds).toEqual([written.attemptId]);
    const w = await prisma.examAttempt.findUniqueOrThrow({ where: { id: written.attemptId } });
    expect(w.status).toBe("graded");
  });
});

describe("Guard: 'Tổ chức thi chính thức' (đợt/ca/phòng) từ chối đề vấn đáp AI", () => {
  it("bulkCreateExamSessionsInRound từ chối — vấn đáp chỉ mở ca qua Link thi nhanh", async () => {
    const s = await setupOral("br1");
    const round = await createExamRound(s.ownerId, {
      code: `RND-${Date.now()}`,
      title: "Đợt test",
      courseId: s.courseId,
    });

    await expect(
      bulkCreateExamSessionsInRound(s.ownerId, round.id, {
        examId: s.examId,
        count: 1,
      }),
    ).rejects.toMatchObject({ code: "exam_not_written" });

    const sessions = await prisma.examSession.count({ where: { roundId: round.id } });
    expect(sessions).toBe(0);
  });

  it("addCandidatesToRoom từ chối — phòng nào cũng vậy, kể cả phòng đã tồn tại sẵn từ trước", async () => {
    // bulkCreateExamSessionsInRound đã chặn không cho sinh phòng mới cho đề
    // vấn đáp — test này mô phỏng phòng LỠ tồn tại từ trước (dữ liệu cũ, hoặc
    // đường khác chưa lường tới) để xác nhận addCandidatesToRoom tự nó cũng
    // chặn, không dựa hẳn vào việc "phòng không bao giờ tồn tại".
    const s = await setupOral("br2");
    const round = await createExamRound(s.ownerId, {
      code: `RND-${Date.now()}`,
      title: "Đợt test",
      courseId: s.courseId,
    });
    const now = new Date();
    const sess = await prisma.examSession.create({
      data: {
        examId: s.examId,
        roundId: round.id,
        opensAt: now,
        closesAt: new Date(now.getTime() + 3600_000),
      },
      select: { id: true },
    });
    const room = await prisma.examRoom.create({
      data: {
        examId: s.examId,
        sessionId: sess.id,
        orderIndex: 1,
        name: "Phòng test",
        proctorUserId: s.ownerId,
      },
      select: { id: true },
    });

    await expect(
      addCandidatesToRoom(s.ownerId, room.id, {
        candidates: [{ displayName: "SV Test", email: "sv-test@e.com" }],
      }),
    ).rejects.toMatchObject({ code: "exam_not_written" });

    const candidates = await prisma.examCandidate.count({ where: { examId: s.examId } });
    expect(candidates).toBe(0);
  });
});
