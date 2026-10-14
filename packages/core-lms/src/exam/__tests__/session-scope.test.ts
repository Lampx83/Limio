import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import { createExam, createExamQuestion, publishExam } from "../";
import {
  canEditSession,
  canViewSession,
  getExamSession,
  pickFreeOpenCode,
} from "../exam-rounds";
import { roundFor } from "../../test/roundFor";
import { shareExamLink } from "../quick-share";

/**
 * Phạm vi của CA (session-scope) — buổi đơn (không đợt) và ca trong đợt.
 *
 *  - Buổi đơn: quyền theo khoá chứa đề, không theo đợt. Người ngoài khoá không
 *    xem/sửa được; giảng viên khoá làm được.
 *  - Ca trong đợt: quyền theo đợt, như trước.
 *  - Link thi nhanh không bao giờ tự nằm trong đợt, kể cả khi đề thuộc một kỳ thi.
 */

const BASE = "http://localhost:3000";
const MCQ = {
  type: "mcq" as const,
  prompt: "Q",
  config: {
    options: [
      { id: "a", label: "A", isCorrect: true },
      { id: "b", label: "B", isCorrect: false },
    ],
  },
};

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `ss-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `ss-x-${slug}@e.com`, password: "password1234", displayName: "X" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `SS ${slug}`,
    description: "x",
    slug: `ss-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Đề",
    durationMin: 30,
    openAt: new Date(Date.now() - 60_000),
    closeAt: new Date(Date.now() + 86_400_000),
  });
  await createExamQuestion(owner.userId, examId, MCQ);
  await publishExam(owner.userId, examId);
  return { ownerId: owner.userId, outsiderId: outsider.userId, courseId: course.courseId, examId };
}

describe("phạm vi ca — buổi đơn theo khoá, ca trong đợt theo đợt", () => {
  it("buổi đơn (link nhanh): giảng viên khoá xem/sửa được, người ngoài khoá thì không", async () => {
    const s = await setup("basic");
    const shared = await shareExamLink(s.ownerId, s.examId);
    const scope = { roundId: null, examId: s.examId };

    expect(await canViewSession(s.ownerId, scope)).toBe(true);
    expect(await canEditSession(s.ownerId, scope)).toBe(true);
    expect(await canViewSession(s.outsiderId, scope)).toBe(false);
    expect(await canEditSession(s.outsiderId, scope)).toBe(false);

    const detail = await getExamSession(s.ownerId, shared.sessionId);
    expect(detail.roundId).toBeNull();
    expect(detail.roundCode).toBeNull();
    await expect(getExamSession(s.outsiderId, shared.sessionId)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("link nhanh KHÔNG bị nhét vào đợt, kể cả khi đề đang nằm trong một đợt chính thức", async () => {
    const s = await setup("not-in-round");
    await roundFor(s.examId); // một kỳ thi chính thức của đề này
    const shared = await shareExamLink(s.ownerId, s.examId);
    const session = await prisma.examSession.findUniqueOrThrow({
      where: { id: shared.sessionId },
      select: { roundId: true },
    });
    expect(session.roundId).toBeNull();
  });

  it("ca trong đợt: quyền theo đợt — trưởng đợt sửa được, người không thuộc đợt thì không", async () => {
    const s = await setup("in-round");
    const roundId = await roundFor(s.examId);
    await prisma.examRoundAdmin.create({ data: { roundId, userId: s.ownerId } });
    const scope = { roundId, examId: s.examId };

    expect(await canEditSession(s.ownerId, scope)).toBe(true);
    expect(await canEditSession(s.outsiderId, scope)).toBe(false);
  });

  it("pickFreeOpenCode: mã cấp ra không trùng ca nào trong hệ thống", async () => {
    const s = await setup("opencode");
    const shared = await shareExamLink(s.ownerId, s.examId);
    const taken = await prisma.examSession.findUniqueOrThrow({
      where: { id: shared.sessionId },
      select: { openCode: true },
    });
    for (let i = 0; i < 20; i++) {
      const code = await pickFreeOpenCode();
      expect(code).not.toBeNull();
      expect(code).not.toBe(taken.openCode);
    }
  });
});
