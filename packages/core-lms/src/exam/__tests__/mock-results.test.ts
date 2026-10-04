import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  applyAutoGradingForAttempt,
  createExam,
  createExamQuestion,
  createSection,
  endCurrentSection,
  getMockAttemptResult,
  getMockAttemptResultForStaff,
  getMockSkillSummary,
  gradeManualExamAnswer,
  publishExam,
  saveAnswer,
  startExamAttempt,
  updateSection,
} from "../";

/**
 * LANG G5d — kết quả theo phần của đề thi thử: đọc từ dữ liệu thật (đáp án đã chấm), so với lượt
 * trước, tóm tắt theo kỹ năng cho hồ sơ. Không có điểm giả khi còn câu chờ chấm.
 */

const BASE = "http://localhost:3000";
const MCQ = {
  type: "mcq" as const,
  prompt: "Q",
  config: { options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
};

async function setup(slug: string, mock = true) {
  const owner = await registerUser({ email: `mr-o-${slug}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `mr-course-${slug}` });
  await prisma.course.update({ where: { id: course.courseId }, data: { status: "published", publishedAt: new Date() } });
  const { examId } = await createExam(owner.userId, course.courseId, { title: "Thi thử", durationMin: 20, mockMode: mock });
  const nghe = await createSection(owner.userId, examId, { title: "Nghe", durationMin: 10, languageSkill: "listening" });
  const viet = await createSection(owner.userId, examId, { title: "Viết", durationMin: 10, languageSkill: "writing" });
  const n1 = await createExamQuestion(owner.userId, examId, { ...MCQ, sectionId: nghe.id });
  const n2 = await createExamQuestion(owner.userId, examId, { ...MCQ, sectionId: nghe.id });
  const essay = await createExamQuestion(owner.userId, examId, {
    type: "essay",
    prompt: "Viết đoạn văn",
    config: {},
    points: 5,
    sectionId: viet.id,
  });
  await publishExam(owner.userId, examId);
  const learner = await registerUser({ email: `mr-l-${slug}@e.com`, password: "password1234", displayName: "L" }, BASE);
  await enrollInCourse(learner.userId, course.courseId);
  return {
    ownerId: owner.userId,
    courseId: course.courseId,
    examId,
    learnerId: learner.userId,
    subject: { kind: "user" as const, userId: learner.userId },
    sections: { nghe: nghe.id, viet: viet.id },
    q: { n1: n1.questionId, n2: n2.questionId, essay: essay.questionId },
  };
}
type S = Awaited<ReturnType<typeof setup>>;

const save = async (s: S, attemptId: string, qid: string, answerJson: unknown) => {
  const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { sessionToken: true } });
  return saveAnswer(s.subject, attemptId, qid, { answerJson, sessionToken: a.sessionToken });
};

/** Làm một lượt: Nghe (n1 đúng/sai theo tham số) → nộp phần → Viết (có bài) → nộp. */
async function takeAttempt(s: S, o: { n1: "a" | "b"; n2: "a" | "b"; essay?: boolean; retake?: boolean }) {
  const { attemptId } = await startExamAttempt(s.learnerId, s.examId, undefined, { retake: o.retake });
  await save(s, attemptId, s.q.n1, { optionIds: [o.n1] });
  await save(s, attemptId, s.q.n2, { optionIds: [o.n2] });
  await endCurrentSection(s.subject, attemptId);
  if (o.essay !== false) await save(s, attemptId, s.q.essay, { text: "Bài viết của tôi." });
  await endCurrentSection(s.subject, attemptId);
  return attemptId;
}

describe("getMockAttemptResult", () => {
  it("G5d.1/2: phần trắc nghiệm có điểm ngay; phần Viết chờ chấm → pending, score null, không điểm giả", async () => {
    const s = await setup("pending");
    const attemptId = await takeAttempt(s, { n1: "a", n2: "b" });
    await applyAutoGradingForAttempt(attemptId);
    const r = (await getMockAttemptResult(s.learnerId, attemptId))!;
    const nghe = r.sections.find((x) => x.sectionId === s.sections.nghe)!;
    const viet = r.sections.find((x) => x.sectionId === s.sections.viet)!;
    expect(nghe).toMatchObject({ questionCount: 2, correctCount: 1, score: 1, maxScore: 2, pending: false, languageSkill: "listening" });
    expect(viet).toMatchObject({ pending: true, pendingCount: 1, score: null, maxScore: 5, languageSkill: "writing" });
  });

  it("G5d.2: giảng viên chấm xong → điểm phần Viết chốt, hết pending", async () => {
    const s = await setup("graded");
    const attemptId = await takeAttempt(s, { n1: "a", n2: "a" });
    await applyAutoGradingForAttempt(attemptId);
    const ans = await prisma.examAnswer.findFirstOrThrow({ where: { attemptId, questionId: s.q.essay } });
    await gradeManualExamAnswer(s.ownerId, ans.id, { manualScore: 4 });
    const r = (await getMockAttemptResult(s.learnerId, attemptId))!;
    expect(r.sections.find((x) => x.sectionId === s.sections.viet)).toMatchObject({ pending: false, score: 4, maxScore: 5 });
    expect(r.sections.find((x) => x.sectionId === s.sections.nghe)).toMatchObject({ score: 2, correctCount: 2 });
  });

  it("G5d.3: có bảng quy đổi do giảng viên nhập → có nhãn ước lượng; không có bảng → null", async () => {
    const s = await setup("bands");
    const attemptId = await takeAttempt(s, { n1: "a", n2: "a" });
    await applyAutoGradingForAttempt(attemptId);
    expect((await getMockAttemptResult(s.learnerId, attemptId))!.sections[0]!.estimate).toBeNull();
    await updateSection(s.ownerId, s.sections.nghe, {
      scoreBands: [{ from: 0, to: 1, label: "100–150" }, { from: 2, to: 2, label: "150–200" }],
    });
    expect((await getMockAttemptResult(s.learnerId, attemptId))!.sections[0]!.estimate).toBe("150–200");
  });

  it("bảng quy đổi không hợp lệ (chồng nhau) bị từ chối khi lưu; sửa được cả sau khi đã có lượt thi", async () => {
    const s = await setup("badbands");
    await takeAttempt(s, { n1: "a", n2: "a" });
    await expect(
      updateSection(s.ownerId, s.sections.nghe, { scoreBands: [{ from: 0, to: 5, label: "A" }, { from: 5, to: 9, label: "B" }] }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(updateSection(s.ownerId, s.sections.nghe, { scoreBands: [{ from: 0, to: 5, label: "A" }] })).resolves.toBeUndefined();
    await expect(updateSection(s.ownerId, s.sections.nghe, { scoreBands: null })).resolves.toBeUndefined(); // bỏ bảng
  });

  it("G5d.4: so với lượt trước từng phần — tăng/giảm/không đổi; phần pending không so", async () => {
    const s = await setup("compare");
    const first = await takeAttempt(s, { n1: "b", n2: "b" });
    await applyAutoGradingForAttempt(first);
    const second = await takeAttempt(s, { n1: "a", n2: "a", retake: true });
    await applyAutoGradingForAttempt(second);
    const r = (await getMockAttemptResult(s.learnerId, second))!;
    expect(r.previous).toMatchObject({ attemptId: first });
    expect(r.trends[s.sections.nghe]).toBe("up"); // 0/2 → 2/2
    expect(r.trends[s.sections.viet]).toBeNull(); // Viết còn chờ chấm ở cả hai lượt
    // lượt đầu không có lượt trước
    expect((await getMockAttemptResult(s.learnerId, first))!.previous).toBeNull();
  });

  it("G5d.5: thời gian đã dùng không vượt thời gian được phép", async () => {
    const s = await setup("time");
    const attemptId = await takeAttempt(s, { n1: "a", n2: "a" });
    const r = (await getMockAttemptResult(s.learnerId, attemptId))!;
    expect(r.allowedSec).toBe(20 * 60);
    expect(r.timeSpentSec).toBeGreaterThanOrEqual(0);
    expect(r.timeSpentSec).toBeLessThanOrEqual(r.allowedSec);
  });

  it("đề thường → null (không có kết quả theo phần)", async () => {
    const s = await setup("regular", false);
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await prisma.examAttempt.update({ where: { id: attemptId }, data: { status: "submitted", submittedAt: new Date() } });
    expect(await getMockAttemptResult(s.learnerId, attemptId)).toBeNull();
  });

  it("G5d.7: chỉ chủ lượt thi xem được; đang làm dở thì chưa có kết quả", async () => {
    const s = await setup("authz");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await expect(getMockAttemptResult(s.learnerId, attemptId)).rejects.toMatchObject({ code: "validation_failed" });
    await endCurrentSection(s.subject, attemptId);
    await endCurrentSection(s.subject, attemptId);
    await expect(getMockAttemptResult(s.ownerId, attemptId)).rejects.toMatchObject({ code: "attempt_belongs_to_other" });
    await expect(getMockAttemptResult(s.learnerId, attemptId)).resolves.not.toBeNull();
  });

  it("G5d.7: giảng viên của khoá xem được qua hàm riêng; người ngoài khoá thì không", async () => {
    const s = await setup("staff");
    const attemptId = await takeAttempt(s, { n1: "a", n2: "a" });
    await expect(getMockAttemptResultForStaff(s.ownerId, attemptId)).resolves.toMatchObject({ attemptId });
    const stranger = await registerUser({ email: "mr-x-staff@e.com", password: "password1234", displayName: "X" }, BASE);
    await expect(getMockAttemptResultForStaff(stranger.userId, attemptId)).rejects.toBeTruthy();
  });
});

describe("getMockSkillSummary (G5d.6) — khối 'Thi thử' của hồ sơ", () => {
  it("không có lượt thi thử nào → null", async () => {
    const s = await setup("none");
    await enrollInCourse(s.learnerId, s.courseId).catch(() => undefined);
    expect(await getMockSkillSummary(s.learnerId, s.courseId)).toBeNull();
  });

  it("gom theo kỹ năng của phần (lượt mới nhất vs lượt trước); phần chờ chấm không có phần trăm", async () => {
    const s = await setup("summary");
    const first = await takeAttempt(s, { n1: "b", n2: "b" });
    await applyAutoGradingForAttempt(first);
    const second = await takeAttempt(s, { n1: "a", n2: "b", retake: true });
    await applyAutoGradingForAttempt(second);
    const sum = (await getMockSkillSummary(s.learnerId, s.courseId))!;
    expect(sum.attemptId).toBe(second);
    const listening = sum.skills.find((x) => x.skill === "listening")!;
    expect(listening).toMatchObject({ pct: 50, previousPct: 0, trend: "up" });
    const writing = sum.skills.find((x) => x.skill === "writing")!;
    expect(writing).toMatchObject({ pct: null, pending: true, trend: null });
    expect(sum.attemptCount).toBe(2);
  });
});
