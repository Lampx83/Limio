import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByOpenCode,
  createExam,
  createExamQuestion,
  shareExamLink,
} from "../";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setup(slug: string, opts: { withQuestion?: boolean } = {}) {
  const owner = await registerUser(
    { email: `qs-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `qs-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 15,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 86_400_000),
  });
  if (opts.withQuestion !== false) {
    await createExamQuestion(owner.userId, examId, {
      type: "mcq",
      prompt: "1+1?",
      config: mcq(),
      points: 10,
    });
  }
  return { ownerId: owner.userId, examId };
}

describe("shareExamLink — phát link một nút", () => {
  it("publish đề, dựng ca + phòng, sinh mã, trả link", async () => {
    const s = await setup("basic");
    const r = await shareExamLink(s.ownerId, s.examId);

    expect(r.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(r.path).toBe(`/exam/${r.code}`);
    expect(r.published).toBe(true);

    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } });
    expect(exam.status).toBe("published");
    expect(exam.accessMode).toBe("open_code");

    const session = await prisma.examSession.findUniqueOrThrow({
      where: { id: r.sessionId },
    });
    // Ca thủ công: mở ngay, không có giờ đóng.
    expect(session.timingMode).toBe("manual");
    expect(session.status).toBe("open");
    expect(session.closesAt).toBeNull();

    // Phòng mặc định phải có, nếu không thí sinh rơi ra ngoài bảng kết quả.
    const rooms = await prisma.examRoom.count({ where: { sessionId: r.sessionId } });
    expect(rooms).toBeGreaterThanOrEqual(1);
  });

  it("học sinh vào được ngay bằng mã vừa phát", async () => {
    const s = await setup("enter");
    const r = await shareExamLink(s.ownerId, s.examId);

    const claim = await claimByOpenCode(r.code, {
      displayName: "Học sinh A",
      phone: "0900000009",
      email: "hs-a@e.com",
    });
    expect(claim.attemptId).toBeTruthy();
  });

  it("bấm lại không đổi mã dưới chân học sinh đang chờ", async () => {
    const s = await setup("idem");
    const first = await shareExamLink(s.ownerId, s.examId);
    const second = await shareExamLink(s.ownerId, s.examId);

    expect(second.code).toBe(first.code);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.reusedExistingCode).toBe(true);
    expect(second.published).toBe(false);

    const sessions = await prisma.examSession.count({ where: { examId: s.examId } });
    expect(sessions).toBe(1);
  });

  it("từ chối đề chưa có câu hỏi nào", async () => {
    const s = await setup("empty", { withQuestion: false });
    await expect(shareExamLink(s.ownerId, s.examId)).rejects.toMatchObject({
      code: "validation_failed",
    });
    // Không được publish nửa vời khi đã từ chối.
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } });
    expect(exam.status).toBe("draft");
  });

  it("từ chối người không có quyền sửa khoá học", async () => {
    const s = await setup("authz");
    const stranger = await registerUser(
      { email: "qs-stranger@e.com", password: "password1234", displayName: "X" },
      BASE,
    );
    await expect(
      shareExamLink(stranger.userId, s.examId),
    ).rejects.toBeTruthy();
  });

  it("chế độ hẹn giờ vẫn dùng cửa sổ của đề", async () => {
    const s = await setup("sched");
    const r = await shareExamLink(s.ownerId, s.examId, { timingMode: "scheduled" });
    const session = await prisma.examSession.findUniqueOrThrow({
      where: { id: r.sessionId },
    });
    expect(session.timingMode).toBe("scheduled");
    expect(session.closesAt).not.toBeNull();
  });
});

describe("thời lượng và giờ thuộc BUỔI THI, không thuộc gói đề", () => {
  it("thời lượng ghi vào ca, không đụng gói đề", async () => {
    const s = await setup("dur");
    const r = await shareExamLink(s.ownerId, s.examId, { durationMin: 45 });

    const session = await prisma.examSession.findUniqueOrThrow({
      where: { id: r.sessionId },
    });
    expect(session.durationOverrideMin).toBe(45);

    // Gói đề giữ nguyên con số mặc định của nó.
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } });
    expect(exam.durationMin).toBe(15);
  });

  it("cùng một gói đề mở được hai buổi với thời lượng khác nhau", async () => {
    const s = await setup("two");
    const first = await shareExamLink(s.ownerId, s.examId, { durationMin: 15 });

    // Buổi thứ hai: tạo ca riêng (shareExamLink dùng lại ca cũ nên tạo tay).
    const round = await prisma.examSession.findUniqueOrThrow({
      where: { id: first.sessionId },
      select: { roundId: true },
    });
    const second = await prisma.examSession.create({
      data: {
        examId: s.examId,
        roundId: round.roundId,
        accessMode: "open_code",
        openCode: "TWOSES",
        timingMode: "manual",
        status: "open",
        opensAt: new Date(),
        closesAt: null,
        durationOverrideMin: 30,
      },
      select: { id: true, durationOverrideMin: true },
    });

    expect(second.durationOverrideMin).toBe(30);
    const all = await prisma.examSession.findMany({
      where: { examId: s.examId },
      select: { durationOverrideMin: true },
      orderBy: { createdAt: "asc" },
    });
    expect(all.map((x) => x.durationOverrideMin)).toEqual([15, 30]);
  });

  it("hẹn giờ thì ghi đúng hai mốc vào ca", async () => {
    const s = await setup("sched2");
    const opensAt = new Date(Date.now() + 3600_000);
    const closesAt = new Date(Date.now() + 7200_000);
    const r = await shareExamLink(s.ownerId, s.examId, {
      timingMode: "scheduled",
      opensAt,
      closesAt,
      durationMin: 20,
    });
    const session = await prisma.examSession.findUniqueOrThrow({
      where: { id: r.sessionId },
    });
    expect(session.timingMode).toBe("scheduled");
    expect(session.opensAt.getTime()).toBe(opensAt.getTime());
    expect(session.closesAt?.getTime()).toBe(closesAt.getTime());
    expect(session.durationOverrideMin).toBe(20);
  });

  it("từ chối khi giờ mở nằm sau giờ đóng", async () => {
    const s = await setup("badwin");
    await expect(
      shareExamLink(s.ownerId, s.examId, {
        timingMode: "scheduled",
        opensAt: new Date(Date.now() + 7200_000),
        closesAt: new Date(Date.now() + 3600_000),
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});
