import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import {
  claimByOpenCode,
  createExam,
  createExamQuestion,
  createExamRound,
  publishExam,
  roundDisplayWindow,
  shareExamLink,
  startExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setup(slug: string, examOverrides: Record<string, unknown> = {}) {
  const owner = await registerUser(
    { email: `wr-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `wr-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 30,
    ...examOverrides,
  });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: mcq(),
    points: 10,
  });
  return { ownerId: owner.userId, courseId: course.courseId, examId, slug };
}

describe("khung giờ của ĐỀ không còn chặn ai", () => {
  it("tạo đề được mà không cần nhập hai mốc giờ", async () => {
    const s = await setup("nowindow");
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } });
    // Cột còn NOT NULL nên vẫn có giá trị, chỉ là rộng và vô nghĩa.
    expect(e.openAt).toBeInstanceOf(Date);
    expect(e.closeAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("đề CHƯA có ca thi thì học viên không vào được, dù khung giờ của đề đang mở", async () => {
    const now = Date.now();
    const s = await setup("nosession", {
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 86_400_000),
    });
    await publishExam(s.ownerId, s.examId);
    // publishExam dựng sẵn một ca mặc định; xoá đi để dựng lại đúng trạng thái
    // "đề không có ca nào" — thứ mà trước đây vẫn thi được nhờ rơi về khung
    // giờ của đề.
    await prisma.examRoom.deleteMany({
      where: { session: { examId: s.examId } },
    });
    await prisma.examSession.deleteMany({ where: { examId: s.examId } });

    const learner = await registerUser(
      { email: `wr-l-${s.slug}@e.com`, password: "password1234", displayName: "L" },
      BASE,
    );
    await enrollInCourse(learner.userId, s.courseId);

    await expect(
      startExamAttempt(learner.userId, s.examId),
    ).rejects.toMatchObject({ code: "exam_not_open" });
  });

  it("có ca thi rồi thì vào được, DÙ khung giờ của đề đã đóng từ lâu", async () => {
    const now = Date.now();
    const s = await setup("closedexam", {
      // Khung của đề đã đóng từ hôm qua.
      openAt: new Date(now - 2 * 86_400_000),
      closeAt: new Date(now - 86_400_000),
    });
    const r = await shareExamLink(s.ownerId, s.examId);

    const claim = await claimByOpenCode(r.code, {
      displayName: "Thí sinh",
      phone: "0900000011",
      email: `wr-c-${s.slug}@e.com`,
    });
    expect(claim.attemptId).toBeTruthy();
  });

  it("mã cũ gắn thẳng vào đề, không qua ca, thì không mở được", async () => {
    const now = Date.now();
    const s = await setup("legacy", {
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 86_400_000),
    });
    await publishExam(s.ownerId, s.examId);
    // Dựng đúng trạng thái legacy: mã nằm trên Exam, không có ca nào.
    await prisma.examRoom.deleteMany({
      where: { session: { examId: s.examId } },
    });
    await prisma.examSession.deleteMany({ where: { examId: s.examId } });
    await prisma.exam.update({
      where: { id: s.examId },
      data: { accessMode: "open_code", openCode: "LEGCY1" },
    });

    await expect(
      claimByOpenCode("LEGCY1", {
        displayName: "X",
        phone: "0900000012",
        email: `wr-lg-${s.slug}@e.com`,
      }),
    ).rejects.toMatchObject({ code: "exam_not_open" });
  });
});

describe("khung giờ của ĐỢT suy từ các ca", () => {
  it("tạo đợt được mà không cần nhập hai mốc giờ", async () => {
    const s = await setup("round");
    const r = await createExamRound(s.ownerId, {
      code: `R-${s.slug}`.toUpperCase().slice(0, 20),
      title: "Đợt thi",
      courseId: s.courseId,
    });
    expect(r.id).toBeTruthy();
  });

  it("đợt chưa có ca thì không có khung giờ để hiện", async () => {
    const s = await setup("emptyround");
    const r = await createExamRound(s.ownerId, {
      code: `E-${s.slug}`.toUpperCase().slice(0, 20),
      title: "Đợt rỗng",
      courseId: s.courseId,
    });
    const w = await roundDisplayWindow(r.id);
    expect(w.sessionCount).toBe(0);
    expect(w.opensAt).toBeNull();
    expect(w.closesAt).toBeNull();
  });

  it("khung hiển thị bám theo ca, không bám cột của đợt", async () => {
    const s = await setup("derive");
    const shared = await shareExamLink(s.ownerId, s.examId);
    const session = await prisma.examSession.findUniqueOrThrow({
      where: { id: shared.sessionId },
      select: { roundId: true },
    });

    // Cố tình đặt cột của đợt lệch hẳn khỏi ca — đúng tình trạng 4/6 đợt trên
    // production. Khung hiển thị phải bỏ qua nó.
    await prisma.examRound.update({
      where: { id: session.roundId },
      data: {
        opensAt: new Date("2020-01-01T00:00:00Z"),
        closesAt: new Date("2020-01-02T00:00:00Z"),
      },
    });

    const w = await roundDisplayWindow(session.roundId);
    expect(w.sessionCount).toBe(1);
    expect(new Date(w.opensAt!).getFullYear()).toBeGreaterThan(2020);
    // Ca thủ công không có giờ đóng → đợt cũng không có mốc đóng để hiện.
    expect(w.closesAt).toBeNull();
  });
});
