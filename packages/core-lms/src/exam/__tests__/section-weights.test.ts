import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  applyAutoGradingForAttempt,
  buildScoringPlan,
  createExam,
  createExamQuestion,
  createSection,
  deleteSection,
  getSectionWeights,
  gradeManualExamAnswer,
  publishExam,
  scorePctFor,
  setSectionWeights,
} from "../";

const BASE = "http://localhost:3000";

const sec = (id: string, weight: number | null, qs: Array<[string, number]>, mode: "fixed" | "random_from_bank" = "fixed") => ({
  id,
  title: id,
  weight,
  selectionMode: mode,
  questions: qs.map(([qid, points]) => ({ id: qid, points })),
});

describe("buildScoringPlan / scorePctFor — hàm thuần", () => {
  const qs = [
    { id: "q1", points: 10 },
    { id: "q2", points: 10 },
    { id: "q3", points: 10 },
  ];

  it("chỉ áp trọng số khi đủ mọi điều kiện; thiếu một điều kiện thì nói rõ lý do và tính theo tỉ lệ điểm", () => {
    const ok = [sec("A", 40, [["q1", 10], ["q2", 10]]), sec("B", 60, [["q3", 10]])];
    expect(buildScoringPlan(ok, qs)).toMatchObject({ weighted: true, reason: null });

    expect(buildScoringPlan([sec("A", null, [["q1", 10], ["q2", 10]]), sec("B", null, [["q3", 10]])], qs)).toMatchObject({
      weighted: false,
      reason: "no_weights",
    });
    expect(buildScoringPlan([sec("A", 40, [["q1", 10], ["q2", 10]]), sec("B", null, [["q3", 10]])], qs).reason).toBe("incomplete");
    expect(buildScoringPlan([sec("A", 40, [["q1", 10], ["q2", 10]]), sec("B", 50, [["q3", 10]])], qs)).toMatchObject({
      reason: "sum",
      weightSum: 90,
    });
    // q3 nằm ngoài mọi phần
    expect(buildScoringPlan([sec("A", 40, [["q1", 10]]), sec("B", 60, [["q2", 10]])], qs)).toMatchObject({
      reason: "orphans",
      orphanQuestionCount: 1,
    });
    expect(buildScoringPlan([sec("A", 100, [["q1", 10], ["q2", 10], ["q3", 10]])], qs).reason).toBe("single_section");
    expect(
      buildScoringPlan([sec("A", 40, [["q1", 10], ["q2", 10]]), sec("B", 60, [["q3", 10]], "random_from_bank")], qs).reason,
    ).toBe("not_fixed");
    expect(buildScoringPlan([sec("A", 40, [["q1", 10], ["q2", 10], ["q3", 10]]), sec("B", 60, [])], qs).reason).toBe("empty_section");
  });

  it("điểm % = Σ (điểm đạt ÷ điểm tối đa của phần × trọng số); không có trọng số thì theo tỉ lệ điểm", () => {
    const plan = buildScoringPlan(
      [sec("A", 40, [["q1", 10], ["q2", 10]]), sec("B", 60, [["q3", 10]])],
      qs,
    );
    // Phần A đúng 1/2 câu (10/20), phần B đúng hết (10/10): 0,5×40 + 1×60 = 80.
    expect(scorePctFor(plan, new Map([["q1", 10], ["q2", 0], ["q3", 10]]), 20)).toBeCloseTo(80, 6);
    // Ví dụ trong tiêu chí: trắc nghiệm 24/30 (40%), tự luận 15/20 (60%) ⇒ 77.
    const plan2 = buildScoringPlan(
      [sec("T", 40, [["t1", 30]]), sec("L", 60, [["l1", 20]])],
      [{ id: "t1", points: 30 }, { id: "l1", points: 20 }],
    );
    expect(scorePctFor(plan2, new Map([["t1", 24], ["l1", 15]]), 39)).toBeCloseTo(77, 6);

    const raw = buildScoringPlan([sec("A", null, [["q1", 10], ["q2", 10]]), sec("B", null, [["q3", 10]])], qs);
    expect(scorePctFor(raw, new Map(), 20)).toBeCloseTo((20 / 30) * 100, 6);
  });
});

async function user(tag: string) {
  return registerUser(
    { email: `sw-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e.com`, password: "password1234", displayName: tag },
    BASE,
  );
}

const MCQ = {
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
};

/** Đề: phần 1 có 2 câu trắc nghiệm (10đ/câu), phần 2 có 1 câu trắc nghiệm (10đ) + 1 tự luận (20đ). */
async function setup(slug: string) {
  const owner = await user(`own-${slug}`);
  const course = await createCourse(owner.userId, { title: `C ${slug}`, description: "x", slug: `sw-${slug}-${Date.now()}` });
  const { examId } = await createExam(owner.userId, course.courseId, { title: `Đề ${slug}`, durationMin: 20 });
  const s1 = await createSection(owner.userId, examId, { title: "Trắc nghiệm" });
  const s2 = await createSection(owner.userId, examId, { title: "Tự luận" });
  const mk = (sectionId: string | undefined, type: "mcq" | "essay", points: number) =>
    createExamQuestion(owner.userId, examId, {
      type,
      prompt: "Q",
      config: type === "mcq" ? MCQ : {},
      points,
      sectionId,
    }).then((r) => r.questionId);
  const q1 = await mk(s1.id, "mcq", 10);
  const q2 = await mk(s1.id, "mcq", 10);
  const q3 = await mk(s2.id, "mcq", 10);
  const q4 = await mk(s2.id, "essay", 20);
  await publishExam(owner.userId, examId);
  return { ownerId: owner.userId, examId, s1: s1.id, s2: s2.id, q: { q1, q2, q3, q4 } };
}

type S = Awaited<ReturnType<typeof setup>>;

/** Một bài đã nộp: mỗi câu một điểm; essay: `null` = chờ chấm. */
async function submittedAttempt(s: S, scores: { q1: number; q2: number; q3: number; q4: number | null }, status: "graded" | "submitted" = "graded") {
  const learner = await user("hv");
  const total = scores.q1 + scores.q2 + scores.q3 + (scores.q4 ?? 0);
  const a = await prisma.examAttempt.create({
    data: {
      examId: s.examId,
      userId: learner.userId,
      durationSec: 1200,
      status,
      score: total,
      scorePct: scores.q4 === null ? null : (total / 50) * 100,
      submittedAt: new Date(),
    },
  });
  for (const [key, qid] of Object.entries(s.q) as Array<[keyof typeof s.q, string]>) {
    const score = scores[key];
    await prisma.examAnswer.create({
      data: {
        attemptId: a.id,
        questionId: qid,
        autoScore: key === "q4" ? null : score,
        manualScore: key === "q4" ? score : null,
        needsGrading: key === "q4" && score === null,
      },
    });
  }
  return a;
}

describe("setSectionWeights — đặt trọng số theo Phần", () => {
  it("báo đúng lỗi: thiếu phần, tổng sai, câu ngoài phần, có người đang làm bài, không có quyền", async () => {
    const s = await setup("validate");
    await expect(setSectionWeights(s.ownerId, s.examId, { weights: [{ sectionId: s.s1, weight: 100 }] })).rejects.toMatchObject({
      code: "validation_failed",
      details: { reason: "weights_incomplete" },
    });
    await expect(
      setSectionWeights(s.ownerId, s.examId, {
        weights: [{ sectionId: s.s1, weight: 40 }, { sectionId: s.s2, weight: 50 }],
      }),
    ).rejects.toMatchObject({ code: "validation_failed", details: { reason: "weights_sum", sum: 90 } });

    // thêm một câu nằm ngoài mọi phần
    await createExamQuestion(s.ownerId, s.examId, { type: "mcq", prompt: "Mồ côi", config: MCQ, points: 5 });
    await expect(
      setSectionWeights(s.ownerId, s.examId, {
        weights: [{ sectionId: s.s1, weight: 40 }, { sectionId: s.s2, weight: 60 }],
      }),
    ).rejects.toMatchObject({ details: { reason: "weights_orphans", count: 1 } });

    const s2 = await setup("validate2");
    const learner = await user("dang-lam");
    await prisma.examAttempt.create({ data: { examId: s2.examId, userId: learner.userId, durationSec: 1200, status: "in_progress" } });
    await expect(
      setSectionWeights(s2.ownerId, s2.examId, {
        weights: [{ sectionId: s2.s1, weight: 40 }, { sectionId: s2.s2, weight: 60 }],
      }),
    ).rejects.toMatchObject({ details: { reason: "attempts_in_progress" } });

    const stranger = await user("la");
    await expect(
      setSectionWeights(stranger.userId, s2.examId, { weights: [] }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("đã có bài nộp thì phải xác nhận; xác nhận xong điểm % tính lại, điểm thô giữ nguyên, ghi sự kiện", async () => {
    const s = await setup("recalc");
    // Phần 1 đúng cả 2 câu (20/20), phần 2: câu trắc nghiệm sai (0/10), tự luận 10/20 ⇒ thô 30/50 = 60%.
    const a = await submittedAttempt(s, { q1: 10, q2: 10, q3: 0, q4: 10 });
    const input = { weights: [{ sectionId: s.s1, weight: 30 }, { sectionId: s.s2, weight: 70 }] };

    await expect(setSectionWeights(s.ownerId, s.examId, input)).rejects.toMatchObject({
      details: { reason: "confirm_required", attempts: 1 },
    });
    expect((await prisma.examAttempt.findUniqueOrThrow({ where: { id: a.id } })).scorePct).toBeCloseTo(60, 6);

    const r = await setSectionWeights(s.ownerId, s.examId, { ...input, confirmRecalc: true });
    expect(r).toMatchObject({ weighted: true, attemptsRecomputed: 1 });
    const after = await prisma.examAttempt.findUniqueOrThrow({ where: { id: a.id } });
    // Phần 1: 20/20 × 30 = 30; phần 2: 10/30 × 70 = 23,33… ⇒ 53,33…
    expect(after.scorePct).toBeCloseTo(30 + (10 / 30) * 70, 6);
    expect(after.score).toBe(30);

    const ev = await prisma.learningEvent.findFirstOrThrow({
      where: { eventType: LearningEventType.ExamWeightsUpdated, userId: s.ownerId },
      orderBy: { occurredAt: "desc" },
    });
    expect(ev.payload).toMatchObject({ examId: s.examId, attemptsRecomputed: 1 });

    // Bỏ trọng số: về lại tỉ lệ điểm.
    await setSectionWeights(s.ownerId, s.examId, { weights: [], confirmRecalc: true });
    expect((await prisma.examAttempt.findUniqueOrThrow({ where: { id: a.id } })).scorePct).toBeCloseTo(60, 6);
    const info = await getSectionWeights(s.ownerId, s.examId);
    expect(info).toMatchObject({ active: false, reason: "no_weights", scoredAttempts: 0 + 1 });
  });

  it("bài còn câu chờ chấm vẫn chưa có điểm %; chấm tay xong thì có điểm % theo trọng số", async () => {
    const s = await setup("pending");
    await setSectionWeights(s.ownerId, s.examId, { weights: [{ sectionId: s.s1, weight: 50 }, { sectionId: s.s2, weight: 50 }] });
    const a = await submittedAttempt(s, { q1: 10, q2: 0, q3: 10, q4: null }, "submitted");
    // bài chưa chấm xong: không bị tính lại thành số
    await setSectionWeights(s.ownerId, s.examId, {
      weights: [{ sectionId: s.s1, weight: 20 }, { sectionId: s.s2, weight: 80 }],
      confirmRecalc: true,
    });
    expect((await prisma.examAttempt.findUniqueOrThrow({ where: { id: a.id } })).scorePct).toBeNull();

    const essay = await prisma.examAnswer.findFirstOrThrow({ where: { attemptId: a.id, questionId: s.q.q4 } });
    await gradeManualExamAnswer(s.ownerId, essay.id, { manualScore: 20, reason: "chấm" });
    const done = await prisma.examAttempt.findUniqueOrThrow({ where: { id: a.id } });
    // Phần 1: 10/20 × 20 = 10; phần 2: 30/30 × 80 = 80 ⇒ 90
    expect(done.status).toBe("graded");
    expect(done.scorePct).toBeCloseTo(90, 6);
    expect(done.score).toBe(40);
  });

  it("bài nộp MỚI được chấm tự động cũng dùng trọng số", async () => {
    const s = await setup("autograde");
    await prisma.examQuestion.update({ where: { id: s.q.q4 }, data: { type: "mcq", config: MCQ as never } });
    await setSectionWeights(s.ownerId, s.examId, { weights: [{ sectionId: s.s1, weight: 25 }, { sectionId: s.s2, weight: 75 }] });
    const learner = await user("moi");
    const a = await prisma.examAttempt.create({
      data: { examId: s.examId, userId: learner.userId, durationSec: 1200, status: "submitted", submittedAt: new Date() },
    });
    // Phần 1 đúng 1/2 câu; phần 2 đúng câu 10đ, sai câu 20đ.
    const ans = (questionId: string, optionId: string) =>
      prisma.examAnswer.create({ data: { attemptId: a.id, questionId, answerJson: { optionIds: [optionId] } } });
    await ans(s.q.q1, "a");
    await ans(s.q.q2, "b");
    await ans(s.q.q3, "a");
    await ans(s.q.q4, "b");
    const r = await applyAutoGradingForAttempt(a.id);
    expect(r).toMatchObject({ fullyGraded: true, autoScore: 20 });
    const after = await prisma.examAttempt.findUniqueOrThrow({ where: { id: a.id } });
    // 10/20 × 25 + 10/30 × 75 = 12,5 + 25 = 37,5
    expect(after.scorePct).toBeCloseTo(37.5, 6);
  });

  it("đã đặt trọng số thì không thêm hoặc xoá Phần được (tránh tổng trọng số lệch âm thầm)", async () => {
    const s = await setup("lock");
    await setSectionWeights(s.ownerId, s.examId, { weights: [{ sectionId: s.s1, weight: 40 }, { sectionId: s.s2, weight: 60 }] });
    await expect(createSection(s.ownerId, s.examId, { title: "Mới" })).rejects.toMatchObject({
      details: { reason: "section_weights_set" },
    });
    await expect(deleteSection(s.ownerId, s.s2)).rejects.toMatchObject({ details: { reason: "section_weights_set" } });
    await setSectionWeights(s.ownerId, s.examId, { weights: [] });
    await expect(createSection(s.ownerId, s.examId, { title: "Mới" })).resolves.toBeTruthy();
  });
});
