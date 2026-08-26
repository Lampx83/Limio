import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import {
  computeExamAnalytics,
  copyBankQuestionToExam,
  createBank,
  createBankQuestion,
  createExam,
  createExamQuestion,
  publishExam,
  saveAnswer,
  startExamAttempt,
  submitExamAttempt,
} from "../";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
    { id: "c", label: "C", isCorrect: false },
  ],
});

/**
 * Một đề chở HAI câu: một câu lấy từ ngân hàng (có ExamQuestionFromBank) và
 * một câu gõ thẳng vào đề. Chỉ câu đầu được ghi lịch sử thử nghiệm.
 */
async function setup(slug: string) {
  const owner = await registerUser(
    { email: `its-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `its-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });

  const bank = await createBank(owner.userId, {
    name: `Bank ${slug}`,
    courseId: course.courseId,
  });
  // Câu ở trạng thái nháp — đúng như quy trình: thử nghiệm trước, kết nạp sau.
  const bq = await createBankQuestion(owner.userId, bank.id, {
    type: "mcq",
    prompt: "Câu đem thử nghiệm",
    config: mcq(),
    points: 1,
  });

  const now = Date.now();
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề thử ${slug}`,
    durationMin: 60,
    openAt: new Date(now - 60_000),
    closeAt: new Date(now + 7 * 24 * 60 * 60_000),
    // Đề thử nghiệm — điều kiện để chở được câu còn ở trạng thái nháp.
    purpose: "field_test",
  });

  const copied = await copyBankQuestionToExam(owner.userId, bq.id, examId);
  const adhoc = await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Câu gõ thẳng vào đề",
    config: mcq(),
    points: 1,
  });

  await publishExam(owner.userId, examId);

  return {
    ownerId: owner.userId,
    courseId: course.courseId,
    examId,
    bankQuestionId: bq.id,
    bankExamQuestionId: copied.examQuestionId,
    adhocQuestionId: adhoc.questionId,
    slug,
  };
}

/** Cho `n` học viên làm bài; `correctCount` em đầu chọn đúng. */
async function runCohort(
  s: Awaited<ReturnType<typeof setup>>,
  n: number,
  correctCount: number,
) {
  for (let i = 0; i < n; i++) {
    const learner = await registerUser(
      {
        email: `its-l-${s.slug}-${i}@e.com`,
        password: "password1234",
        displayName: `L${i}`,
      },
      BASE,
    );
    await enrollInCourse(learner.userId, s.courseId);
    const start = await startExamAttempt(learner.userId, s.examId);
    const pick = i < correctCount ? "a" : "b";
    for (const qid of [s.bankExamQuestionId, s.adhocQuestionId]) {
      await saveAnswer({ kind: "user", userId: learner.userId }, start.attemptId, qid, {
        answerJson: { optionIds: [pick] },
        sessionToken: start.sessionToken,
      });
    }
    await submitExamAttempt({ kind: "user", userId: learner.userId }, start.attemptId);
  }
}

describe("lịch sử thử nghiệm câu hỏi", () => {
  it("chốt một quan sát cho câu có nguồn từ ngân hàng", async () => {
    const s = await setup("basic");
    await runCohort(s, 6, 4);

    const r = await computeExamAnalytics(s.examId);
    expect(r.trialsWritten).toBe(1);

    const rows = await prisma.itemTrialStat.findMany({
      where: { bankQuestionId: s.bankQuestionId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attemptCount).toBe(6);
    expect(rows[0]!.correctCount).toBe(4);
    // p = 4/6 ≈ 0,667 — vượt ngưỡng n ≥ 5 nên không còn sentinel.
    expect(rows[0]!.pValue).toBeCloseTo(4 / 6, 5);
  });

  it("KHÔNG ghi câu gõ thẳng vào đề — nó không có danh tính bền vững", async () => {
    const s = await setup("adhoc");
    await runCohort(s, 6, 4);
    await computeExamAnalytics(s.examId);

    const rows = await prisma.itemTrialStat.findMany({ where: { examId: s.examId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.examQuestionId).toBe(s.bankExamQuestionId);
  });

  it("ghi lại đúng PHIÊN BẢN câu chữ đã đem thử", async () => {
    const s = await setup("version");
    await runCohort(s, 6, 3);
    await computeExamAnalytics(s.examId);

    const row = await prisma.itemTrialStat.findFirstOrThrow({
      where: { examId: s.examId },
    });
    const link = await prisma.examQuestionFromBank.findUniqueOrThrow({
      where: { examQuestionId: s.bankExamQuestionId },
    });
    expect(row.bankQuestionVersionId).toBe(link.bankQuestionVersionId);
  });

  it("chạy cron lại không đẻ thêm dòng — cập nhật đúng chỗ", async () => {
    const s = await setup("idem");
    await runCohort(s, 6, 2);
    await computeExamAnalytics(s.examId);
    const first = await prisma.itemTrialStat.findFirstOrThrow({
      where: { examId: s.examId },
    });
    expect(first.correctCount).toBe(2);

    // Thêm người làm rồi chạy lại: vẫn một dòng, số liệu mới.
    await runCohort({ ...s, slug: `${s.slug}-b` }, 4, 4);
    const r = await computeExamAnalytics(s.examId);
    expect(r.trialsWritten).toBe(1);

    const rows = await prisma.itemTrialStat.findMany({ where: { examId: s.examId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.examQuestionId).toBe(first.examQuestionId);
    expect(rows[0]!.attemptCount).toBe(10);
    expect(rows[0]!.correctCount).toBe(6);
  });

  it("gắn được vào đợt thi của đề", async () => {
    const s = await setup("round");
    await runCohort(s, 6, 3);
    await computeExamAnalytics(s.examId);

    const row = await prisma.itemTrialStat.findFirstOrThrow({
      where: { examId: s.examId },
    });
    const session = await prisma.examSession.findFirst({
      where: { examId: s.examId },
      select: { roundId: true },
    });
    // publishExam ensure sẵn ca + đợt mặc định, nên phải khớp.
    expect(row.roundId).toBe(session?.roundId ?? null);
  });

  it("không xoá lịch sử khi ExamQuestionStats bị ghi đè", async () => {
    const s = await setup("keep");
    await runCohort(s, 6, 5);
    await computeExamAnalytics(s.examId);
    const before = await prisma.itemTrialStat.findFirstOrThrow({
      where: { examId: s.examId },
    });

    // Chạy lại nhiều lần — ExamQuestionStats bị upsert đè mỗi lần.
    await computeExamAnalytics(s.examId);
    await computeExamAnalytics(s.examId);

    const after = await prisma.itemTrialStat.findMany({ where: { examId: s.examId } });
    expect(after).toHaveLength(1);
    expect(after[0]!.examQuestionId).toBe(before.examQuestionId);
    expect(after[0]!.correctCount).toBe(5);
  });
});

describe("hàng rào câu nháp", () => {
  async function bankAndCourse(slug: string) {
    const owner = await registerUser(
      { email: `gate-${slug}@e.com`, password: "password1234", displayName: "O" },
      BASE,
    );
    const course = await createCourse(owner.userId, {
      title: `C ${slug}`,
      description: "x",
      slug: `gate-course-${slug}`,
    });
    const bank = await createBank(owner.userId, {
      name: `Bank ${slug}`,
      courseId: course.courseId,
    });
    const draft = await createBankQuestion(owner.userId, bank.id, {
      type: "mcq",
      prompt: "Câu còn nháp",
      config: mcq(),
      points: 1,
    });
    return { ownerId: owner.userId, courseId: course.courseId, draftId: draft.id };
  }

  function examInput(purpose: "assessment" | "field_test") {
    const now = Date.now();
    return {
      title: "Đề",
      durationMin: 60,
      openAt: new Date(now - 60_000),
      closeAt: new Date(now + 86_400_000),
      purpose,
    };
  }

  it("đề THI THẬT từ chối câu chưa kết nạp", async () => {
    const b = await bankAndCourse("real");
    const { examId } = await createExam(b.ownerId, b.courseId, examInput("assessment"));
    await expect(
      copyBankQuestionToExam(b.ownerId, b.draftId, examId),
    ).rejects.toMatchObject({ code: "bank_question_not_publishable" });
  });

  it("đề THỬ NGHIỆM nhận câu chưa kết nạp — đó là lý do nó tồn tại", async () => {
    const b = await bankAndCourse("trial");
    const { examId } = await createExam(b.ownerId, b.courseId, examInput("field_test"));
    const r = await copyBankQuestionToExam(b.ownerId, b.draftId, examId);
    expect(r.examQuestionId).toBeTruthy();
  });

  it("câu đã loại thì không đường nào cả, kể cả đề thử nghiệm", async () => {
    const b = await bankAndCourse("archived");
    await prisma.bankQuestion.update({
      where: { id: b.draftId },
      data: { status: "archived" },
    });
    const { examId } = await createExam(b.ownerId, b.courseId, examInput("field_test"));
    await expect(
      copyBankQuestionToExam(b.ownerId, b.draftId, examId),
    ).rejects.toMatchObject({ code: "bank_question_not_publishable" });
  });

  it("đề thử nghiệm mặc định KHÔNG hiện đáp án sau khi nộp", async () => {
    const b = await bankAndCourse("noreveal");
    const { examId } = await createExam(b.ownerId, b.courseId, examInput("field_test"));
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(e.purpose).toBe("field_test");
    expect(e.showResultsAfterSubmit).toBe(false);
  });

  it("đề thi thật vẫn mặc định hiện đáp án — không hồi quy", async () => {
    const b = await bankAndCourse("reveal");
    const { examId } = await createExam(b.ownerId, b.courseId, examInput("assessment"));
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(e.purpose).toBe("assessment");
    expect(e.showResultsAfterSubmit).toBe(true);
  });

  it("GV vẫn bật lại được hiện đáp án cho đề thử nếu cố ý", async () => {
    const b = await bankAndCourse("override");
    const { examId } = await createExam(b.ownerId, b.courseId, {
      ...examInput("field_test"),
      showResultsAfterSubmit: true,
    });
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect(e.showResultsAfterSubmit).toBe(true);
  });
});
