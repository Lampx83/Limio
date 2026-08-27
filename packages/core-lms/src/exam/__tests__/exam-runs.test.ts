import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  createExam,
  createExamQuestion,
  ensureDefaultSession,
  listExamRuns,
  publishExam,
  shareExamLink,
} from "../";

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

  it("liệt kê cả lần thi cho học viên đã ghi danh", async () => {
    const s = await setup("auth");
    await publishExam(s.ownerId, s.examId);

    const runs = await listExamRuns(s.ownerId);
    // publishExam dựng sẵn một ca mặc định, accessMode = authenticated.
    expect(runs.some((r) => r.examId === s.examId)).toBe(true);
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

  it("ca sinh ra từ đường đợt/ca mặc định là formal", async () => {
    const s = await setup("scale-formal");
    await publishExam(s.ownerId, s.examId);
    const sessionId = await ensureDefaultSession(s.examId);

    const formal = await listExamRuns(s.ownerId, { scale: "formal" });
    expect(formal.some((r) => r.sessionId === sessionId)).toBe(true);
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

    // 2 bài đã nộp ở ca A, 1 ở ca B.
    const mk = async (sessionId: string, status: "graded" | "in_progress") =>
      prisma.examAttempt.create({
        data: {
          examId: s.examId,
          sessionId,
          candidateDisplayName: "X",
          durationSec: 600,
          status,
          ...(status === "graded" ? { submittedAt: new Date() } : {}),
        },
        select: { id: true },
      });
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
