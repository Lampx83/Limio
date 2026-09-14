import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByOpenCode,
  createExam,
  createExamQuestion,
  getCandidateResultByAttemptId,
  publishExam,
  saveAnswer,
  shareExamLink,
  submitExamAttempt,
} from "../";
import type { ExamSubject } from "../subject";

const BASE = "http://localhost:3000";

/**
 * "Hiện điểm, không hiện đáp án" (score_only) — thí sinh vào bằng mã (link thi
 * nhanh, xem quick-share.ts) xem được điểm cuối cùng ngay khi nộp, nhưng
 * KHÔNG thấy câu nào đúng/sai hay đáp án. Khác `never` (giấu tuyệt đối) và
 * khác `immediately` (lộ cả đáp án — đốt câu hỏi nếu là đề thử nghiệm).
 */
async function setup(slug: string, reveal: "immediately" | "never" | "score_only") {
  const owner = await registerUser(
    { email: `so-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `so-course-${slug}`,
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
    },
    points: 10,
  });
  await publishExam(owner.userId, examId);
  const shared = await shareExamLink(owner.userId, examId, {
    revealAnswers: reveal,
  });
  return { ownerId: owner.userId, examId, questionId: q.questionId, shared };
}

async function takeAndSubmit(
  code: string,
  email: string,
  questionId: string,
  optionId: string,
) {
  const claim = await claimByOpenCode(code, {
    displayName: "Thí sinh",
    studentCode: `SV-${email}`,
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
  await saveAnswer(subject, claim.attemptId, questionId, {
    answerJson: { optionIds: [optionId] },
    sessionToken: claim.sessionToken,
  });
  await submitExamAttempt(subject, claim.attemptId);
  return claim.attemptId;
}

describe("score_only — điểm lộ, đáp án không lộ", () => {
  it("hiện điểm cuối cùng nhưng showDetail=false, details=undefined", async () => {
    const s = await setup("so", "score_only");
    const attemptId = await takeAndSubmit(s.shared.code!, "a@e.com", s.questionId, "b");

    const r = await getCandidateResultByAttemptId(attemptId);
    expect(r.fullyGraded).toBe(true);
    expect(r.showScore).toBe(true);
    expect(r.showDetail).toBe(false);
    expect(r.score).not.toBeNull();
    expect(r.scorePct).not.toBeNull();
    expect(r.totalPoints).toBe(10);
    expect(r.details).toBeUndefined();
  });

  it("so với immediately: cả hai đều thấy điểm, nhưng chỉ immediately mới thấy chi tiết", async () => {
    const s = await setup("cmp", "immediately");
    const attemptId = await takeAndSubmit(s.shared.code!, "b@e.com", s.questionId, "a");

    const r = await getCandidateResultByAttemptId(attemptId);
    expect(r.showScore).toBe(true);
    expect(r.showDetail).toBe(true);
    expect(r.details).toBeDefined();
    expect(r.details![0]!.correct).toBe(true);
  });

  it("so với never: never giấu cả điểm, score_only vẫn cho xem điểm", async () => {
    const s = await setup("hide", "never");
    const attemptId = await takeAndSubmit(s.shared.code!, "c@e.com", s.questionId, "a");

    const r = await getCandidateResultByAttemptId(attemptId);
    expect(r.showScore).toBe(false);
    expect(r.showDetail).toBe(false);
    // Payload thật sự null, không chỉ ẩn ở UI — tránh lộ qua network tab.
    expect(r.score).toBeNull();
    expect(r.scorePct).toBeNull();
  });
});
