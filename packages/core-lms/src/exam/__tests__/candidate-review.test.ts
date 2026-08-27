import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByOpenCode,
  createExam,
  createExamQuestion,
  getExamAttemptReview,
  publishExam,
  saveAnswer,
  shareExamLink,
  submitExamAttempt,
} from "../";
import type { ExamSubject } from "../subject";

const BASE = "http://localhost:3000";

/**
 * Thí sinh vào bằng mã — không có tài khoản — vẫn phải xem lại được bài của
 * CHÍNH MÌNH sau khi nộp, kèm đáp án đúng và giải thích.
 *
 * Trước đây `getExamAttemptReview` chỉ nhận userId, nên đường thí sinh chỉ có
 * chấm xanh/đỏ: biết sai câu nào mà không biết sai chỗ nào.
 */
async function setup(slug: string, reveal: "immediately" | "never") {
  const owner = await registerUser(
    { email: `cr-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `cr-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 20,
  });
  const q = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "2 + 2 = ?",
    config: {
      options: [
        { id: "a", label: "4", isCorrect: true },
        { id: "b", label: "5", isCorrect: false },
      ],
      explanation: "Cộng hai số hạng bằng nhau thì được gấp đôi.",
    },
    points: 10,
  });
  await publishExam(owner.userId, examId);
  const shared = await shareExamLink(owner.userId, examId, {
    revealAnswers: reveal,
  });
  return { ownerId: owner.userId, examId, questionId: q.questionId, shared };
}

async function takeExam(code: string, email: string) {
  const claim = await claimByOpenCode(code, {
    displayName: "Thí sinh",
    phone: "0900000000",
    email,
  });
  const subject: ExamSubject = {
    kind: "candidate",
    candidateId: claim.candidateId,
    attemptId: claim.attemptId,
    examId: claim.examId,
    sessionToken: claim.sessionToken,
  };
  return { claim, subject };
}

describe("thí sinh vào bằng mã xem lại bài", () => {
  it("thấy đáp án và giải thích ngay sau khi nộp", async () => {
    const s = await setup("show", "immediately");
    const { claim, subject } = await takeExam(s.shared.code!, "a@e.com");

    await saveAnswer(subject, claim.attemptId, s.questionId, {
        answerJson: { optionIds: ["b"] },
        sessionToken: claim.sessionToken,
      });
    await submitExamAttempt(subject, claim.attemptId);

    const r = await getExamAttemptReview(subject, claim.attemptId);
    expect(r.questions).toHaveLength(1);
    const q = r.questions[0]!;
    // Giải thích — thứ mà bản cũ không trả về cho thí sinh.
    expect(q.explanation).toBe("Cộng hai số hạng bằng nhau thì được gấp đôi.");
    // Đáp án đúng nằm trong config để giao diện tô được câu nào đúng.
    expect(JSON.stringify(q.config)).toContain("isCorrect");
    // Và bài làm của chính thí sinh.
    expect(q.answer).not.toBeNull();
    expect(q.answer!.score).toBe(0);
  });

  it("ca thi đặt KHÔNG hiện thì vẫn không lộ, dù bài đã chấm xong", async () => {
    const s = await setup("hide", "never");
    const { claim, subject } = await takeExam(s.shared.code!, "b@e.com");

    await saveAnswer(subject, claim.attemptId, s.questionId, {
        answerJson: { optionIds: ["a"] },
        sessionToken: claim.sessionToken,
      });
    await submitExamAttempt(subject, claim.attemptId);

    await expect(
      getExamAttemptReview(subject, claim.attemptId),
    ).rejects.toBeTruthy();
  });

  it("không đọc được bài của thí sinh khác cùng ca", async () => {
    const s = await setup("other", "immediately");
    const a = await takeExam(s.shared.code!, "x@e.com");
    const b = await takeExam(s.shared.code!, "y@e.com");

    await saveAnswer(a.subject, a.claim.attemptId, s.questionId, {
        answerJson: { optionIds: ["a"] },
        sessionToken: a.claim.sessionToken,
      });
    await submitExamAttempt(a.subject, a.claim.attemptId);

    // Cookie của B, bài của A.
    await expect(
      getExamAttemptReview(b.subject, a.claim.attemptId),
    ).rejects.toBeTruthy();
  });
});
