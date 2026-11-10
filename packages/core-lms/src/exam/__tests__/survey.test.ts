import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { enrollInCourse } from "../../learning/enroll";
import {
  buildSurveyColumns,
  claimByAccount,
  claimByOpenCode,
  configSchemaForType,
  createExam,
  createPassage,
  createExamQuestion,
  filterSurveyContent,
  gradeStuckSubmittedAttempts,
  isPassageVisibleInPhase,
  loadSurveyExport,
  saveAnswer,
  shareExamLink,
  startExamAttempt,
  submitExamAttempt,
  surveyAnswerCell,
  updateExam,
} from "../";

// Đề thi dạng Khảo sát — docs/tieu-chi/de-thi-khao-sat.md

describe("cấu hình câu Khảo sát (AC2, AC3)", () => {
  it("lựa chọn không cần đáp án đúng; đề thường vẫn bắt buộc", () => {
    const cfg = { options: [{ id: "a", label: "1" }, { id: "b", label: "2" }] };
    expect(configSchemaForType("mcq", { survey: true }).safeParse(cfg).success).toBe(true);
    expect(configSchemaForType("mcq").safeParse(cfg).success).toBe(false);
  });

  it("câu khảo sát không giữ isCorrect hay acceptedAnswers", () => {
    const r = configSchemaForType("mcq", { survey: true }).parse({
      options: [
        { id: "a", label: "Có", isCorrect: true },
        { id: "b", label: "Không", isCorrect: false },
      ],
      code: "N7",
    });
    expect(r).toEqual({ options: [{ id: "a", label: "Có" }, { id: "b", label: "Không" }], code: "N7" });
    expect(configSchemaForType("short_answer", { survey: true }).parse({ acceptedAnswers: ["x"] })).toEqual({});
  });

  it("thang trượt: max > min, khoảng chia hết cho bước; chỉ có ở đề Khảo sát", () => {
    const s = configSchemaForType("slider", { survey: true });
    expect(s.safeParse({ min: 0, max: 100, step: 10 }).success).toBe(true);
    expect(s.safeParse({ min: 0, max: 100, step: 30 }).success).toBe(false);
    expect(s.safeParse({ min: 10, max: 0, step: 1 }).success).toBe(false);
    expect(configSchemaForType("slider").safeParse({ min: 0, max: 100, step: 10 }).success).toBe(false);
  });

  it("đề Khảo sát không nhận loại câu có đáp án", () => {
    expect(configSchemaForType("ordering", { survey: true }).safeParse({ items: [] }).success).toBe(false);
  });

  it("mã câu: tối đa 20 ký tự, không khoảng trắng", () => {
    const s = configSchemaForType("essay", { survey: true });
    expect(s.safeParse({ code: "TT01" }).success).toBe(true);
    expect(s.safeParse({ code: "TT 01" }).success).toBe(false);
    expect(s.safeParse({ code: "x".repeat(21) }).success).toBe(false);
  });
});

describe("lần đo (AC4)", () => {
  it("ca không phân lần hiện mọi phần; ca lần trước ẩn phần chỉ lần sau", () => {
    expect(isPassageVisibleInPhase("post", null)).toBe(true);
    expect(isPassageVisibleInPhase(null, "pre")).toBe(true);
    expect(isPassageVisibleInPhase("pre", "pre")).toBe(true);
    expect(isPassageVisibleInPhase("post", "pre")).toBe(false);
  });

  it("lọc câu theo phần hiện; câu không thuộc phần luôn hiện", () => {
    const passages = [
      { id: "p1", surveyPhase: "pre" as const },
      { id: "p2", surveyPhase: null },
      { id: "p3", surveyPhase: "post" as const },
    ];
    const questions = [
      { id: "q1", passageId: "p1" },
      { id: "q2", passageId: "p2" },
      { id: "q3", passageId: "p3" },
      { id: "q4", passageId: null },
    ];
    const r = filterSurveyContent(passages, questions, "pre");
    expect(r.passages.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(r.questions.map((q) => q.id)).toEqual(["q1", "q2", "q4"]);
  });
});

describe("ô xuất câu trả lời (AC7)", () => {
  const choice = { options: [{ id: "x" }, { id: "y" }, { id: "z" }] };

  it("lựa chọn ghi thứ tự soạn, không phụ thuộc thứ tự đã xáo", () => {
    expect(surveyAnswerCell("mcq", choice, { optionIds: ["z"] })).toBe(3);
    expect(surveyAnswerCell("multi", choice, { optionIds: ["z", "x"] })).toBe("1;3");
  });

  it("thang trượt ghi số, câu chữ ghi nguyên văn, bỏ trống thành ô trống", () => {
    expect(surveyAnswerCell("slider", {}, { value: 70 })).toBe(70);
    expect(surveyAnswerCell("essay", {}, { text: "  Mô phỏng hay  " })).toBe("Mô phỏng hay");
    expect(surveyAnswerCell("essay", {}, { text: "   " })).toBeNull();
    expect(surveyAnswerCell("mcq", choice, null)).toBeNull();
    expect(surveyAnswerCell("mcq", choice, { optionIds: [] })).toBeNull();
  });

  it("cột theo thứ tự phần rồi câu; thiếu mã câu thì Câu n", () => {
    const cols = buildSurveyColumns(
      [
        { id: "p2", title: "Sau", orderIndex: 1, surveyPhase: "post" },
        { id: "p1", title: "Trước", orderIndex: 0, surveyPhase: "pre" },
      ],
      [
        { id: "a", type: "mcq", prompt: "A", config: { code: "TT01", options: [{ id: "o", label: "Có" }] }, passageId: "p2", orderInPassage: 0, orderInExam: 0 },
        { id: "b", type: "essay", prompt: "B", config: {}, passageId: "p1", orderInPassage: 0, orderInExam: 1 },
      ],
    );
    expect(cols.map((c) => [c.header, c.phase])).toEqual([
      ["Câu 1", "pre"],
      ["TT01", "post"],
    ]);
    expect(cols[1]!.legend).toBe("1 = Có");
  });
});

// ---------------------------------------------------------------------------
// Luồng đầy đủ trên DB test
// ---------------------------------------------------------------------------

const BASE = "http://localhost:3000";
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `sv-o-${slug}@e.com`, password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `sv-${slug}` });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Phiếu ${slug}`,
    durationMin: 30,
    purpose: "survey",
  });
  const pre = await createPassage(owner.userId, examId, { title: "Thông tin nền", contentJson: doc("Lần trước"), surveyPhase: "pre" });
  const both = await createPassage(owner.userId, examId, { title: "Tự tin", contentJson: doc("0 đến 100") });
  const post = await createPassage(owner.userId, examId, { title: "Động lực", contentJson: doc("Lần sau"), surveyPhase: "post" });
  const q = {
    pre: await createExamQuestion(owner.userId, examId, {
      type: "mcq",
      prompt: "Giới tính",
      passageId: pre.passageId,
      config: { code: "N1", options: [{ id: "a", label: "Nam" }, { id: "b", label: "Nữ" }] },
    }),
    both: await createExamQuestion(owner.userId, examId, {
      type: "slider",
      prompt: "Tính tiêu thụ bình quân",
      passageId: both.passageId,
      points: 5,
      config: { code: "TT01", min: 0, max: 100, step: 10 },
    }),
    post: await createExamQuestion(owner.userId, examId, {
      type: "essay",
      prompt: "Điều gì giúp bạn học nhiều nhất?",
      passageId: post.passageId,
      config: { code: "TH7" },
    }),
  };
  const learner = await registerUser(
    { email: `sv-l-${slug}@e.com`, password: "password1234", displayName: "Sinh viên" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  return { ownerId: owner.userId, examId, courseId: course.courseId, q, learnerId: learner.userId };
}

describe("đề Khảo sát — trọn luồng", () => {
  it("đề Khảo sát: không xáo, không hiện kết quả; câu luôn 0 điểm", async () => {
    const s = await setup("settings");
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } });
    expect(exam).toMatchObject({ shuffleQuestions: false, shuffleOptions: false, showResultsAfterSubmit: false, proctoringLevel: "none" });
    const q = await prisma.examQuestion.findUniqueOrThrow({ where: { id: s.q.both.questionId } });
    expect(q.points).toBe(0);
  });

  it("mã câu không được trùng trong cùng phiếu", async () => {
    const s = await setup("dup");
    await expect(
      createExamQuestion(s.ownerId, s.examId, { type: "essay", prompt: "x", config: { code: "tt01" } }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("lần trước và lần sau là hai ca, mỗi ca một lượt; nộp không chấm; xuất đúng cột", async () => {
    const s = await setup("flow");
    const preRun = await shareExamLink(s.ownerId, s.examId, { surveyPhase: "pre" });
    const preSession = await prisma.examSession.findUniqueOrThrow({ where: { id: preRun.sessionId } });
    expect(preSession).toMatchObject({ surveyPhase: "pre", revealAnswers: "never" });

    // Vào bằng tên tự khai bị chặn; người chưa ghi danh bị chặn.
    await expect(
      claimByOpenCode(preRun.code, { displayName: "Ai đó", email: "x@e.com", phone: "0900000000" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const outsider = await registerUser(
      { email: "sv-out-flow@e.com", password: "password1234", displayName: "Ngoài" },
      BASE,
    );
    await expect(claimByAccount(preRun.code, outsider.userId)).rejects.toMatchObject({ code: "not_enrolled" });

    const a = await claimByAccount(preRun.code, s.learnerId);
    const subject = { kind: "candidate" as const, candidateId: a.candidateId, attemptId: a.attemptId, examId: s.examId, sessionToken: a.sessionToken };
    await saveAnswer(subject, a.attemptId, s.q.pre.questionId, { answerJson: { optionIds: ["b"] }, sessionToken: a.sessionToken });
    await saveAnswer(subject, a.attemptId, s.q.both.questionId, { answerJson: { value: 70 }, sessionToken: a.sessionToken });
    const r = await submitExamAttempt(subject, a.attemptId);
    expect(r).toMatchObject({ status: "submitted", fullyGraded: false });

    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: a.attemptId } });
    expect(attempt).toMatchObject({ status: "submitted", score: null, scorePct: null, gradedAt: null });
    expect(await prisma.examAnswer.count({ where: { attemptId: a.attemptId, needsGrading: true } })).toBe(0);
    const graded = await prisma.learningEvent.count({
      where: { eventType: "exam.graded", payload: { path: ["attemptId"], equals: a.attemptId } },
    });
    expect(graded).toBe(0);

    // Cron gỡ kẹt không đụng tới phiếu Khảo sát.
    await prisma.examAttempt.update({ where: { id: a.attemptId }, data: { submittedAt: new Date(Date.now() - 3_600_000) } });
    const swept = await gradeStuckSubmittedAttempts(prisma, { graceMs: 0, batchSize: 1000 });
    expect(swept.attemptIds).not.toContain(a.attemptId);

    // Lần sau: ca khác, cùng sinh viên làm được lượt mới.
    const postRun = await shareExamLink(s.ownerId, s.examId, { surveyPhase: "post" });
    expect(postRun.sessionId).not.toBe(preRun.sessionId);
    const b = await claimByAccount(postRun.code, s.learnerId);
    expect(b.attemptId).not.toBe(a.attemptId);
    const subjectB = { kind: "candidate" as const, candidateId: b.candidateId, attemptId: b.attemptId, examId: s.examId, sessionToken: b.sessionToken };
    await saveAnswer(subjectB, b.attemptId, s.q.post.questionId, { answerJson: { text: "Phần mô phỏng" }, sessionToken: b.sessionToken });
    await submitExamAttempt(subjectB, b.attemptId);

    const all = await loadSurveyExport(s.ownerId, s.examId);
    expect(all.columns.map((c) => c.header)).toEqual(["N1", "TT01", "TH7"]);
    expect(all.rows).toHaveLength(2);
    const preRow = all.rows.find((x) => x.phase === "pre")!;
    expect(preRow).toMatchObject({ name: "Sinh viên", email: "sv-l-flow@e.com", status: "Đã nộp" });
    expect(preRow.cells).toEqual([2, 70, null]);
    const postRow = all.rows.find((x) => x.phase === "post")!;
    expect(postRow.cells).toEqual([null, null, "Phần mô phỏng"]);

    const onlyPost = await loadSurveyExport(s.ownerId, s.examId, { phase: "post" });
    expect(onlyPost.rows).toHaveLength(1);

    // Người không sửa được đề không xuất được.
    await expect(loadSurveyExport(s.learnerId, s.examId)).rejects.toBeTruthy();
  });

  it("học viên không mở phiếu qua đường trang khoá học (chỉ qua mã QR theo lần đo)", async () => {
    const s = await setup("learnpath");
    await shareExamLink(s.ownerId, s.examId, { surveyPhase: "pre" });
    await expect(startExamAttempt(s.learnerId, s.examId)).rejects.toMatchObject({ code: "exam_not_open" });
  });

  it("đã có lượt làm thì không đổi đề ra khỏi Khảo sát", async () => {
    const s = await setup("lock");
    const run = await shareExamLink(s.ownerId, s.examId, { surveyPhase: "pre" });
    await claimByAccount(run.code, s.learnerId);
    await expect(updateExam(s.ownerId, s.examId, { purpose: "assessment" })).rejects.toMatchObject({
      code: "exam_has_attempts",
    });
  });
});
