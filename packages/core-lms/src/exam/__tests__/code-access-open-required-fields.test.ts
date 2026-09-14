import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  claimByOpenCode,
  createExam,
  createExamQuestion,
  lookupCandidateResult,
  publishExam,
  saveAnswer,
  shareExamLink,
  submitExamAttempt,
} from "../";
import type { ExamSubject } from "../subject";

const BASE = "http://localhost:3000";

/**
 * Quét mã QR vào thi (open mode) — chỉ Họ tên + Mã sinh viên là bắt buộc.
 * Phone/email trước đây bắt buộc (Q1); nay tuỳ chọn vì lúc quét QR tại lớp,
 * học sinh không phải lúc nào cũng nhớ/có sẵn email hay SĐT trong tay, nhưng
 * luôn nhớ MSSV. Xem code-access.ts.
 */
async function setup(slug: string) {
  const owner = await registerUser(
    { email: `orf-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `orf-course-${slug}`,
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
    prompt: "Q",
    config: {
      options: [
        { id: "a", label: "A", isCorrect: true },
        { id: "b", label: "B", isCorrect: false },
      ],
    },
    points: 10,
  });
  await publishExam(owner.userId, examId);
  const shared = await shareExamLink(owner.userId, examId);
  return { examId, code: shared.code!, questionId: q.questionId };
}

/** Trả lời + nộp, để attempt lên trạng thái graded — lookup mới trả kết quả. */
async function answerAndSubmit(
  claim: { candidateId: string; attemptId: string; examId: string; sessionToken: string },
  questionId: string,
) {
  const subject: ExamSubject = {
    kind: "candidate",
    candidateId: claim.candidateId,
    attemptId: claim.attemptId,
    examId: claim.examId,
    sessionToken: claim.sessionToken,
  };
  await saveAnswer(subject, claim.attemptId, questionId, {
    answerJson: { optionIds: ["a"] },
    sessionToken: claim.sessionToken,
  });
  await submitExamAttempt(subject, claim.attemptId);
}

describe("claimByOpenCode — Họ tên + MSSV bắt buộc, phone/email tuỳ chọn", () => {
  it("thiếu MSSV thì từ chối", async () => {
    const s = await setup("no-sc");
    await expect(
      claimByOpenCode(s.code, { displayName: "A" }),
    ).rejects.toMatchObject({ code: "candidate_student_code_required" });
  });

  it("thiếu họ tên thì từ chối", async () => {
    const s = await setup("no-name");
    await expect(
      claimByOpenCode(s.code, { studentCode: "K65-001" }),
    ).rejects.toMatchObject({ code: "candidate_name_required" });
  });

  it("chỉ họ tên + MSSV, không phone/email vẫn vào thi được", async () => {
    const s = await setup("min");
    const claim = await claimByOpenCode(s.code, {
      displayName: "Nguyễn Văn A",
      studentCode: "K65-001",
    });
    expect(claim.attemptId).toBeTruthy();
  });

  it("có nhập phone/email nhưng sai định dạng vẫn bị từ chối (không lặng lẽ bỏ qua)", async () => {
    const s = await setup("bad-fmt");
    await expect(
      claimByOpenCode(s.code, {
        displayName: "A",
        studentCode: "K65-002",
        email: "khong-phai-email",
      }),
    ).rejects.toMatchObject({ code: "candidate_email_required" });
  });
});

describe("lookupCandidateResult — mã theo CA (Link thi nhanh) + email HOẶC MSSV", () => {
  it("mã sinh từ shareExamLink (ExamSession.openCode) tra cứu được — không còn báo invalid_code", async () => {
    const s = await setup("session-code");
    const claim = await claimByOpenCode(s.code, {
      displayName: "B",
      studentCode: "K65-003",
      email: "b@e.com",
    });
    await answerAndSubmit(claim, s.questionId);
    // Trước bản vá PR2.12 fallback, nhánh này luôn ném invalid_code vì chỉ
    // tra Exam.openCode (không set bởi shareExamLink) — không phải result_not_found.
    const r = await lookupCandidateResult(s.code, "b@e.com");
    expect(r.candidateName).toBe("B");
  });

  it("không có email lúc claim → vẫn tra được bằng MSSV", async () => {
    const s = await setup("by-sc");
    const claim = await claimByOpenCode(s.code, {
      displayName: "C",
      studentCode: "K65-004",
    });
    await answerAndSubmit(claim, s.questionId);
    const r = await lookupCandidateResult(s.code, "K65-004");
    expect(r.candidateName).toBe("C");
  });

  it("thiếu cả email lẫn MSSV thì báo yêu cầu định danh, không phải invalid_code", async () => {
    const s = await setup("empty-id");
    await expect(lookupCandidateResult(s.code, "")).rejects.toMatchObject({
      code: "candidate_email_required",
    });
  });
});
