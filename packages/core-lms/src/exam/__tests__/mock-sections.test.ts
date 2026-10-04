import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { registerUser } from "../../auth/register";
import { enrollInCourse } from "../../learning/enroll";
import {
  createExam,
  createExamQuestion,
  createSection,
  endCurrentSection,
  extendAttempt,
  getAttemptRuntime,
  publishExam,
  saveAnswer,
  startExamAttempt,
  updateSection,
  getSectionHeartbeat,
  autoSubmitExpiredAttemptsMarkOnly,
} from "../";

/**
 * LANG G5a — đề thi thử: giờ riêng từng phần, làm lần lượt, không quay lại.
 * Mọi hành vi chỉ bật khi Exam.mockMode; đề thường giữ nguyên (G5a.12).
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

interface Opts {
  mock?: boolean;
  /** phút từng phần; undefined = phần không có giờ */
  minutes?: (number | undefined)[];
  publish?: boolean;
}

async function setup(slug: string, o: Opts = {}) {
  const { mock = true, minutes = [30, 60], publish = true } = o;
  const owner = await registerUser(
    { email: `ms-o-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `Course ${slug}`,
    description: "x",
    slug: `ms-course-${slug}`,
  });
  await prisma.course.update({
    where: { id: course.courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Thi thử",
    durationMin: 90,
    mockMode: mock,
  });
  const sections: { id: string; questionIds: string[] }[] = [];
  for (const [i, m] of minutes.entries()) {
    const { id } = await createSection(owner.userId, examId, {
      title: `Phần ${i + 1}`,
      ...(m !== undefined ? { durationMin: m } : {}),
      languageSkill: i === 0 ? "listening" : "reading",
    });
    const questionIds: string[] = [];
    for (let k = 0; k < 2; k++) {
      const q = await createExamQuestion(owner.userId, examId, { ...MCQ, sectionId: id });
      questionIds.push(q.questionId);
    }
    sections.push({ id, questionIds });
  }
  if (publish) await publishExam(owner.userId, examId);
  const learner = await registerUser(
    { email: `ms-l-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  await enrollInCourse(learner.userId, course.courseId);
  const subject = { kind: "user" as const, userId: learner.userId };
  return { ownerId: owner.userId, examId, sections, learnerId: learner.userId, subject };
}

/** Lưu đáp án như trình thi thật: kèm sessionToken hiện hành của lượt thi. */
async function save(
  s: { subject: { kind: "user"; userId: string } },
  attemptId: string,
  questionId: string,
  option: string,
) {
  const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { sessionToken: true } });
  return saveAnswer(s.subject, attemptId, questionId, {
    answerJson: { optionIds: [option] },
    sessionToken: a.sessionToken,
  });
}

/** Lùi giờ bắt đầu để mô phỏng thời gian trôi (máy chủ tính theo startedAt). */
const rewind = (attemptId: string, minutes: number) =>
  prisma.examAttempt.update({
    where: { id: attemptId },
    data: { startedAt: new Date(Date.now() - minutes * 60_000) },
  });

describe("G5a — xuất bản đề thi thử", () => {
  it("G5a.10: phần không có giờ → không xuất bản được, báo đúng tên phần", async () => {
    const s = await setup("pub-nodur", { minutes: [30, undefined], publish: false });
    await expect(publishExam(s.ownerId, s.examId)).rejects.toMatchObject({
      code: "exam_not_publishable",
      details: { errors: expect.arrayContaining([expect.stringContaining("Phần 2")]) },
    });
  });

  it("G5a.10: giờ phần ngoài 1–240 phút bị từ chối ngay khi nhập", async () => {
    const s = await setup("pub-range", { publish: false });
    for (const bad of [0, 241, -5, 1.5]) {
      await expect(updateSection(s.ownerId, s.sections[0]!.id, { durationMin: bad }), String(bad)).rejects.toMatchObject({
        code: "validation_failed",
      });
    }
    await updateSection(s.ownerId, s.sections[0]!.id, { durationMin: 240 }); // đối chứng: biên hợp lệ
  });

  it("G5a.10: phần không có câu nào → không xuất bản được", async () => {
    const s = await setup("pub-empty", { publish: false });
    await createSection(s.ownerId, s.examId, { title: "Phần rỗng", durationMin: 10 });
    await expect(publishExam(s.ownerId, s.examId)).rejects.toMatchObject({
      code: "exam_not_publishable",
      details: { errors: expect.arrayContaining([expect.stringContaining("Phần rỗng")]) },
    });
  });

  it("G5a.10: câu không thuộc phần nào → không xuất bản được", async () => {
    const s = await setup("pub-orphan", { publish: false });
    await createExamQuestion(s.ownerId, s.examId, MCQ); // không sectionId
    await expect(publishExam(s.ownerId, s.examId)).rejects.toMatchObject({ code: "exam_not_publishable" });
  });

  it("đề hợp lệ xuất bản được và Exam.durationMin được chuẩn hoá thành tổng giờ các phần", async () => {
    const s = await setup("pub-ok");
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: s.examId } });
    expect(exam.durationMin).toBe(90); // 30 + 60
  });

  it("G5a.12: đề thường KHÔNG bị các luật trên (phần không giờ, câu lẻ vẫn xuất bản được)", async () => {
    const s = await setup("pub-regular", { mock: false, minutes: [undefined], publish: false });
    await createExamQuestion(s.ownerId, s.examId, MCQ);
    await expect(publishExam(s.ownerId, s.examId)).resolves.toBeUndefined();
  });
});

describe("G5a — làm bài theo phần", () => {
  it("G5a.1: durationSec = tổng giờ các phần; phần đầu chạy, phần sau chưa mở", async () => {
    const s = await setup("start");
    const { attemptId, durationSec } = await startExamAttempt(s.learnerId, s.examId);
    expect(durationSec).toBe(90 * 60);
    const rt = await getAttemptRuntime(s.subject, attemptId);
    expect(rt.sectionFlow).not.toBeNull();
    expect(rt.sectionFlow!.activeSectionId).toBe(s.sections[0]!.id);
    expect(rt.sectionFlow!.sections.map((x) => x.state)).toEqual(["active", "upcoming"]);
    expect(rt.sectionFlow!.remainingSec).toBeGreaterThan(30 * 60 - 5);
    expect(rt.sectionFlow!.remainingSec).toBeLessThanOrEqual(30 * 60);
  });

  it("G5a.5: máy chủ chỉ trả id câu của phần hiện tại (không giấu bằng giao diện)", async () => {
    const s = await setup("visible");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    const rt = await getAttemptRuntime(s.subject, attemptId);
    expect([...rt.sectionFlow!.activeQuestionIds].sort()).toEqual([...s.sections[0]!.questionIds].sort());
  });

  it("G5a.2: lưu đáp án câu của phần chưa mở → section_not_active; câu của phần hiện tại → được", async () => {
    const s = await setup("lock");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await expect(
      save(s, attemptId, s.sections[0]!.questionIds[0]!, "a"),
    ).resolves.toBeDefined(); // đối chứng: phần hiện tại lưu được
    await expect(
      save(s, attemptId, s.sections[1]!.questionIds[0]!, "a"),
    ).rejects.toMatchObject({ code: "section_not_active" });
    expect(await prisma.examAnswer.count({ where: { attemptId, questionId: s.sections[1]!.questionIds[0]! } })).toBe(0);
  });

  it("G5a.3: hết giờ phần 1 (không ai mở trang) → phần 2 mở, phần 1 bị khoá, đáp án cũ giữ nguyên", async () => {
    const s = await setup("advance");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    const q1 = s.sections[0]!.questionIds[0]!;
    await save(s, attemptId, q1, "a");
    await rewind(attemptId, 31);

    await expect(save(s, attemptId, q1, "b")).rejects.toMatchObject({
      code: "section_not_active",
    });
    await expect(
      save(s, attemptId, s.sections[1]!.questionIds[0]!, "a"),
    ).resolves.toBeDefined();
    const kept = await prisma.examAnswer.findFirstOrThrow({ where: { attemptId, questionId: q1 } });
    expect(JSON.stringify(kept.answerJson)).toContain("a");
    const rt = await getAttemptRuntime(s.subject, attemptId);
    expect(rt.sectionFlow!.activeSectionId).toBe(s.sections[1]!.id);
    expect(rt.sectionFlow!.sections.map((x) => x.state)).toEqual(["done", "active"]);
  });

  it("G5a.6: tải lại trang (gọi lại runtime) không đặt lại đồng hồ phần", async () => {
    const s = await setup("reload");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await rewind(attemptId, 10);
    const a = await getAttemptRuntime(s.subject, attemptId);
    const b = await getAttemptRuntime(s.subject, attemptId);
    expect(a.sectionFlow!.remainingSec).toBeLessThanOrEqual(20 * 60);
    expect(a.sectionFlow!.remainingSec).toBeGreaterThan(19 * 60 - 5);
    expect(Math.abs(a.sectionFlow!.remainingSec - b.sectionFlow!.remainingSec)).toBeLessThanOrEqual(2);
  });

  it("G5a.4: 'Nộp phần' mở phần kế ngay, không quay lại phần đã nộp", async () => {
    const s = await setup("endsec");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    const r = await endCurrentSection(s.subject, attemptId);
    expect(r.finished).toBe(false);
    const rt = await getAttemptRuntime(s.subject, attemptId);
    expect(rt.sectionFlow!.activeSectionId).toBe(s.sections[1]!.id);
    expect(rt.sectionFlow!.remainingSec).toBeGreaterThan(59 * 60 - 5); // phần 2 có đủ 60 phút
    await expect(
      save(s, attemptId, s.sections[0]!.questionIds[0]!, "a"),
    ).rejects.toMatchObject({ code: "section_not_active" });
  });

  it("G5a.4: nộp phần cuối → nộp cả bài", async () => {
    const s = await setup("endlast");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await endCurrentSection(s.subject, attemptId);
    const r = await endCurrentSection(s.subject, attemptId);
    expect(r.finished).toBe(true);
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(a.status).not.toBe("in_progress");
    expect(a.submittedAt).not.toBeNull();
  });

  it("G5a.4: nộp phần là idempotent theo phần — gọi lặp (mạng chập chờn) không nuốt luôn phần kế", async () => {
    const s = await setup("endidem");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    const first = s.sections[0]!.id;
    await endCurrentSection(s.subject, attemptId, { expectSectionId: first });
    const again = await endCurrentSection(s.subject, attemptId, { expectSectionId: first });
    expect(again.finished).toBe(false);
    const rt = await getAttemptRuntime(s.subject, attemptId);
    expect(rt.sectionFlow!.activeSectionId).toBe(s.sections[1]!.id); // vẫn ở phần 2
  });

  it("người khác không nộp phần hộ được", async () => {
    const s = await setup("endother");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await expect(
      endCurrentSection({ kind: "user", userId: s.ownerId }, attemptId),
    ).rejects.toMatchObject({ code: "attempt_belongs_to_other" });
  });

  it("G5a.9: giảng viên gia hạn → cộng vào phần đang chạy", async () => {
    const s = await setup("extend");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await extendAttempt(s.ownerId, attemptId, 5);
    const rt = await getAttemptRuntime(s.subject, attemptId);
    expect(rt.sectionFlow!.remainingSec).toBeGreaterThan(35 * 60 - 5); // 30 + 5
    const a = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(a.durationSec).toBe(95 * 60);
  });

  it("G5a.7: heartbeat trả phần hiện tại và giây còn lại; đề thường trả null", async () => {
    const s = await setup("hb");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await rewind(attemptId, 31);
    const hb = await getSectionHeartbeat(s.subject, attemptId);
    expect(hb).toMatchObject({ activeSectionId: s.sections[1]!.id, finished: false });
    expect(hb!.remainingSec).toBeGreaterThan(58 * 60);
    const r = await setup("hb-regular", { mock: false });
    const st = await startExamAttempt(r.learnerId, r.examId);
    expect(await getSectionHeartbeat(r.subject, st.attemptId)).toBeNull();
  });

  it("G5a.8: cron tự nộp xử lý đề thi thử khi hết tổng giờ (và chưa nộp khi còn phần)", async () => {
    const s = await setup("cron");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await rewind(attemptId, 89); // còn 1 phút của phần cuối
    await autoSubmitExpiredAttemptsMarkOnly();
    expect((await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe("in_progress");
    await rewind(attemptId, 91);
    const r = await autoSubmitExpiredAttemptsMarkOnly();
    expect(r.attemptIds).toContain(attemptId);
    expect((await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).not.toBe("in_progress");
    // và sau khi nộp thì phần không còn chạy
    const rt = await getAttemptRuntime(s.subject, attemptId);
    expect(rt.sectionFlow!.finished).toBe(true);
  });

  it("G5a.11: phát event exam.section.started / ended, mỗi cái một lần dù gọi lại nhiều lần", async () => {
    const s = await setup("events");
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await getAttemptRuntime(s.subject, attemptId);
    await getAttemptRuntime(s.subject, attemptId);
    await endCurrentSection(s.subject, attemptId);
    await getAttemptRuntime(s.subject, attemptId);
    await getAttemptRuntime(s.subject, attemptId);
    const count = (type: string) =>
      prisma.learningEvent.count({ where: { eventType: type, userId: s.learnerId } });
    expect(await count("exam.section.started")).toBe(2);
    expect(await count("exam.section.ended")).toBe(1);
  });
});

describe("G5a — hồi quy: đề thường không đổi", () => {
  it("G5a.12: không có sectionFlow, lưu đáp án câu bất kỳ, không có khoá phần", async () => {
    const s = await setup("regular", { mock: false });
    const { attemptId, durationSec } = await startExamAttempt(s.learnerId, s.examId);
    expect(durationSec).toBe(90 * 60);
    const rt = await getAttemptRuntime(s.subject, attemptId);
    expect(rt.sectionFlow).toBeNull();
    await expect(
      save(s, attemptId, s.sections[1]!.questionIds[0]!, "a"),
    ).resolves.toBeDefined();
  });

  it("G5a.12: endCurrentSection trên đề thường bị từ chối", async () => {
    const s = await setup("regular2", { mock: false });
    const { attemptId } = await startExamAttempt(s.learnerId, s.examId);
    await expect(endCurrentSection(s.subject, attemptId)).rejects.toMatchObject({ code: "not_mock_exam" });
  });

  it("đã có lượt thi thì không đổi mockMode được", async () => {
    const s = await setup("lockflag", { mock: false });
    await startExamAttempt(s.learnerId, s.examId);
    const { updateExam } = await import("../exams");
    await expect(updateExam(s.ownerId, s.examId, { mockMode: true })).rejects.toMatchObject({
      code: "exam_has_attempts",
    });
  });
});
