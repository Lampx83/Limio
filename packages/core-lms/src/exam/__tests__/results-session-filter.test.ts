import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createExamQuestion,
  ensureDefaultRound,
  listExamResults,
} from "../";

const BASE = "http://localhost:3000";

/**
 * Kỳ thi chính thức cho học viên ĐÃ GHI DANH: bài làm không có
 * ExamCandidate, chỉ có userId. Bộ lọc cũ đi qua `candidate.sessionId` nên
 * loại sạch nhóm này — mở kết quả một ca thì bảng trống, trông như chưa ai
 * thi.
 */
describe("kết quả lọc theo ca — học viên đã ghi danh", () => {
  it("bài của học viên ghi danh KHÔNG bị bộ lọc ca loại mất", async () => {
    const owner = await registerUser(
      { email: "rsf-gv@e.com", password: "password1234", displayName: "GV" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: "C rsf",
      description: "x",
      slug: "rsf-course",
    });
    await prisma.course.update({
      where: { id: course.courseId },
      data: { status: "published", publishedAt: new Date() },
    });
    const { examId } = await createExam(owner.userId, course.courseId, {
      title: "Đề rsf",
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
    const ca = await prisma.examSession.create({
      data: {
        examId,
        roundId,
        title: "Ca sáng",
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 3_600_000),
      },
      select: { id: true },
    });

    const hs = await registerUser(
      { email: "rsf-hs@e.com", password: "password1234", displayName: "Học sinh" },
      BASE,
    );
    await enrollInCourse(hs.userId, course.courseId);

    // Bài làm của học viên ghi danh: có userId + sessionId, KHÔNG có candidate.
    await prisma.examAttempt.create({
      data: {
        examId,
        userId: hs.userId,
        sessionId: ca.id,
        durationSec: 1200,
        status: "graded",
        score: 10,
        scorePct: 100,
        submittedAt: new Date(),
        gradedAt: new Date(),
      },
    });

    const r = await listExamResults(owner.userId, examId, { sessionId: ca.id });
    const rows = r.rows.filter((x) => x.attemptId !== null);

    // Bản cũ trả về 0 dòng — đúng cái user báo ở Kỳ thi chính thức.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBe("Học sinh");
    expect(rows[0]!.sessionId).toBe(ca.id);
    // Nhãn ca lấy được dù không đi qua ExamCandidate.
    expect(rows[0]!.sessionTitle).toBe("Ca sáng");
  });

  it("vẫn không lẫn bài của ca khác", async () => {
    const owner = await registerUser(
      { email: "rsf2-gv@e.com", password: "password1234", displayName: "GV" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: "C rsf2",
      description: "x",
      slug: "rsf2-course",
    });
    await prisma.course.update({
      where: { id: course.courseId },
      data: { status: "published", publishedAt: new Date() },
    });
    const { examId } = await createExam(owner.userId, course.courseId, {
      title: "Đề rsf2",
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
    const mk = () =>
      prisma.examSession.create({
        data: {
          examId,
          roundId,
          opensAt: new Date(),
          closesAt: new Date(Date.now() + 3_600_000),
        },
        select: { id: true },
      });
    const caA = await mk();
    const caB = await mk();

    for (const [ca, name] of [
      [caA.id, "A1"],
      [caB.id, "B1"],
    ] as const) {
      const u = await registerUser(
        { email: `rsf2-${name}@e.com`, password: "password1234", displayName: name },
        BASE,
      );
      await enrollInCourse(u.userId, course.courseId);
      await prisma.examAttempt.create({
        data: {
          examId,
          userId: u.userId,
          sessionId: ca,
          durationSec: 1200,
          status: "graded",
          score: 10,
          scorePct: 100,
          submittedAt: new Date(),
        },
      });
    }

    const a = await listExamResults(owner.userId, examId, { sessionId: caA.id });
    const names = a.rows.filter((x) => x.attemptId).map((x) => x.displayName);
    expect(names).toEqual(["A1"]);
  });
});
