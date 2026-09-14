import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import {
  addCandidatesToRoom,
  applyAutoGradingForAttempt,
  bulkCreateExamSessionsInRound,
  createExam,
  createExamRound,
  createOralMaterialTopicList,
  disqualifyAttempt,
  extendAttempt,
  forceSubmitAttemptMarkOnly,
  publishExam,
  startOralExamAttempt,
} from "../";

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
