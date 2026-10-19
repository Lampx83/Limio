import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  createExam,
  createExamQuestion,
  createExamRound,
  createFormalSession,
  ensureDefaultSession,
  listExamRuns,
  publishExam,
  shareExamLink,
} from "../";
import { openForEnrolled } from "../../test/openForEnrolled";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `runs-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `runs-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 20,
  });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: mcq(),
    points: 10,
  });
  return { ownerId: owner.userId, courseId: course.courseId, examId };
}

describe("listExamRuns", () => {
  it("liệt kê lần thi phát bằng link nhanh", async () => {
    const s = await setup("quick");
    const shared = await shareExamLink(s.ownerId, s.examId, { durationMin: 12 });

    const runs = await listExamRuns(s.ownerId);
    const mine = runs.find((r) => r.sessionId === shared.sessionId);
    expect(mine).toBeTruthy();
    expect(mine!.code).toBe(shared.code);
    expect(mine!.isOpen).toBe(true);
    expect(mine!.durationMin).toBe(12);
  });

  it("KHÔNG bỏ sót lần thi tổ chức theo đường ca/phòng", async () => {
    const s = await setup("assigned");
    await publishExam(s.ownerId, s.examId);
    const sessionId = await ensureDefaultSession(s.examId);
    // Ca kiểu cấp mã riêng cho từng thí sinh — không có mã chung để phát.
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { accessMode: "assigned_code", openCode: null },
    });

    const runs = await listExamRuns(s.ownerId);
    const mine = runs.find((r) => r.sessionId === sessionId);
    // Bộ lọc cũ (openCode not null + accessMode open_code) sẽ giấu mất lần này.
    expect(mine).toBeTruthy();
    expect(mine!.code).toBeNull();
    expect(mine!.path).toBeNull();
    expect(mine!.accessMode).toBe("assigned_code");
  });

  it("ghi tên đợt cho ca thuộc đợt; buổi đơn không có đợt thì null", async () => {
    const s = await setup("roundtitle");
    const quick = await shareExamLink(s.ownerId, s.examId, { durationMin: 12 });
    const { id: roundId } = await createExamRound(s.ownerId, {
      courseId: s.courseId,
      code: "RT-2026",
      title: "Giữa kỳ Lập trình",
    });
    // Ca thứ hai, gắn vào đợt (shareExamLink đã publish đề rồi).
    const inRound = await prisma.examSession.create({
      data: {
        examId: s.examId,
        roundId,
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 3_600_000),
        scale: "formal",
      },
      select: { id: true },
    });
    const sessionId = inRound.id;

    const runs = await listExamRuns(s.ownerId);
    expect(runs.find((r) => r.sessionId === sessionId)!.roundTitle).toBe("Giữa kỳ Lập trình");
    expect(runs.find((r) => r.sessionId === quick.sessionId)!.roundTitle).toBeNull();
  });

  it("liệt kê cả lần thi cho học viên đã ghi danh", async () => {
    const s = await setup("auth");
    await publishExam(s.ownerId, s.examId);
    // Publish không tự mở thi — tổ chức một đợt chính thức cho học viên ghi danh.
    const sessionId = await openForEnrolled(s.ownerId, s.examId);

    const runs = await listExamRuns(s.ownerId);
    const mine = runs.find((r) => r.sessionId === sessionId);
    expect(mine?.accessMode).toBe("authenticated");
  });

  it("giữ cả lần đã đóng, có cờ phân biệt", async () => {
    const s = await setup("closed");
    const shared = await shareExamLink(s.ownerId, s.examId);
    await prisma.examSession.update({
      where: { id: shared.sessionId },
      data: { status: "closed" },
    });

    const runs = await listExamRuns(s.ownerId);
    const mine = runs.find((r) => r.sessionId === shared.sessionId);
    expect(mine).toBeTruthy();
    expect(mine!.isOpen).toBe(false);
  });

  it("không lộ lần thi của giảng viên khác", async () => {
    const s = await setup("privacy");
    await shareExamLink(s.ownerId, s.examId);
    const stranger = await registerUser(
      { email: "runs-stranger@e.com", password: "password1234", displayName: "X" },
      BASE,
    );

    const runs = await listExamRuns(stranger.userId);
    expect(runs.some((r) => r.examId === s.examId)).toBe(false);
  });
});

describe("lọc lịch sử theo hình thức tổ chức", () => {
  it("link nhanh ghi scale=simple, không lẫn vào lịch sử kỳ thi", async () => {
    const s = await setup("scale-simple");
    const shared = await shareExamLink(s.ownerId, s.examId);

    const simple = await listExamRuns(s.ownerId, {
      purpose: "assessment",
      scale: "simple",
    });
    expect(simple.some((r) => r.sessionId === shared.sessionId)).toBe(true);

    const formal = await listExamRuns(s.ownerId, { scale: "formal" });
    expect(formal.some((r) => r.sessionId === shared.sessionId)).toBe(false);
  });

  it("ca mặc định của đề là buổi đơn (simple), không lẫn vào kỳ thi chính thức", async () => {
    const s = await setup("scale-default");
    await publishExam(s.ownerId, s.examId);
    const sessionId = await ensureDefaultSession(s.examId);

    const simple = await listExamRuns(s.ownerId, { scale: "simple" });
    expect(simple.some((r) => r.sessionId === sessionId)).toBe(true);
    const formal = await listExamRuns(s.ownerId, { scale: "formal" });
    expect(formal.some((r) => r.sessionId === sessionId)).toBe(false);
  });

  it("đề thử nghiệm không lẫn vào lịch sử link nhanh", async () => {
    const s = await setup("scale-ft");
    await prisma.exam.update({
      where: { id: s.examId },
      data: { purpose: "field_test" },
    });
    const shared = await shareExamLink(s.ownerId, s.examId);

    const quick = await listExamRuns(s.ownerId, {
      purpose: "assessment",
      scale: "simple",
    });
    expect(quick.some((r) => r.sessionId === shared.sessionId)).toBe(false);

    const ft = await listExamRuns(s.ownerId, {
      purpose: "field_test",
      scale: "simple",
    });
    expect(ft.some((r) => r.sessionId === shared.sessionId)).toBe(true);
  });
});

describe("đếm lượt thi theo TỪNG ca", () => {
  it("hai ca của cùng gói đề không cộng dồn số của nhau", async () => {
    const s = await setup("dem");
    await publishExam(s.ownerId, s.examId);

    const caA = await shareExamLink(s.ownerId, s.examId, { durationMin: 10 });
    await prisma.examSession.update({
      where: { id: caA.sessionId },
      data: { status: "closed" },
    });
    const caB = await shareExamLink(s.ownerId, s.examId, { durationMin: 10 });
    expect(caB.sessionId).not.toBe(caA.sessionId);

    // 2 bài đã nộp ở ca A, 1 ở ca B. Mỗi bài phải gắn đúng một chủ thể —
    // hoặc học viên đã ghi danh, hoặc thí sinh vào bằng mã (ExamAttempt_subject_xor).
    const mk = async (sessionId: string, status: "graded" | "in_progress") => {
      const c = await prisma.examCandidate.create({
        data: {
          examId: s.examId,
          sessionId,
          displayName: "X",
          accessCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
        },
        select: { id: true },
      });
      return prisma.examAttempt.create({
        data: {
          examId: s.examId,
          sessionId,
          candidateId: c.id,
          candidateDisplayName: "X",
          durationSec: 600,
          status,
          ...(status === "graded" ? { submittedAt: new Date() } : {}),
        },
        select: { id: true },
      });
    };
    await mk(caA.sessionId, "graded");
    await mk(caA.sessionId, "graded");
    await mk(caB.sessionId, "graded");
    await mk(caB.sessionId, "in_progress");

    const runs = await listExamRuns(s.ownerId, { scale: "simple" });
    const a = runs.find((r) => r.sessionId === caA.sessionId)!;
    const b = runs.find((r) => r.sessionId === caB.sessionId)!;

    // Bản cũ đếm theo examId với ca kiểu ghi danh nên cả hai cùng ra 3.
    expect(a.submittedCount).toBe(2);
    expect(a.startedCount).toBe(2);
    expect(b.submittedCount).toBe(1);
    // Bài đang làm dở tính vào startedCount nhưng KHÔNG tính là đã nộp.
    expect(b.startedCount).toBe(2);
  });
});

describe("createFormalSession — ca chính thức không cần đợt", () => {
  it("tạo ca formal, roundId=null, có phòng mặc định và hiện ở lịch sử chính thức", async () => {
    const s = await setup("formal-noround");
    await publishExam(s.ownerId, s.examId);
    const { id } = await createFormalSession(s.ownerId, {
      examId: s.examId,
      title: "Ca sáng",
      accessMode: "assigned_code",
    });

    const row = await prisma.examSession.findUniqueOrThrow({
      where: { id },
      select: { roundId: true, scale: true, accessMode: true, title: true, openCode: true },
    });
    expect(row.roundId).toBeNull();
    expect(row.scale).toBe("formal");
    expect(row.accessMode).toBe("assigned_code");
    expect(row.openCode).toBeNull();
    expect(await prisma.examRoom.count({ where: { sessionId: id } })).toBeGreaterThan(0);

    const runs = await listExamRuns(s.ownerId, { scale: "formal" });
    const mine = runs.find((r) => r.sessionId === id);
    expect(mine).toBeTruthy();
    expect(mine!.roundId).toBeNull();
    expect(mine!.roundTitle).toBeNull();
  });

  it("chế độ Tự do (open_code) sinh mã chung cho ca", async () => {
    const s = await setup("formal-open");
    await publishExam(s.ownerId, s.examId);
    const { id } = await createFormalSession(s.ownerId, {
      examId: s.examId,
      accessMode: "open_code",
    });
    const row = await prisma.examSession.findUniqueOrThrow({
      where: { id },
      select: { openCode: true },
    });
    expect(row.openCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("người không phải giảng viên của đề thì bị chặn", async () => {
    const s = await setup("formal-forbid");
    const stranger = await registerUser(
      { email: `stranger-formal-${Date.now()}@e.com`, password: "password1234", displayName: "S" },
      BASE,
    );
    await expect(
      createFormalSession(stranger.userId, { examId: s.examId, accessMode: "open_code" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("giờ đóng không sau giờ mở thì từ chối", async () => {
    const s = await setup("formal-window");
    const t = new Date();
    await expect(
      createFormalSession(s.ownerId, {
        examId: s.examId,
        accessMode: "open_code",
        opensAt: new Date(t.getTime() + 7_200_000),
        closesAt: new Date(t.getTime() + 3_600_000),
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});
