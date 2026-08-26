import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  assessPromotionReadiness,
  createBank,
  createBankQuestion,
  getItemTrialHistory,
  promoteBankQuestion,
  TRIAL_MIN_N,
} from "../";

const BASE = "http://localhost:3000";

const mcq = () => ({
  options: [
    { id: "a", label: "A", isCorrect: true },
    { id: "b", label: "B", isCorrect: false },
  ],
});

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `ih-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `ih-course-${slug}`,
  });
  const bank = await createBank(owner.userId, {
    name: `Bank ${slug}`,
    courseId: course.courseId,
  });
  const q = await createBankQuestion(owner.userId, bank.id, {
    type: "mcq",
    prompt: "Câu thử nghiệm",
    config: mcq(),
    points: 1,
  });
  return { ownerId: owner.userId, courseId: course.courseId, bankQuestionId: q.id };
}

/** Ghi thẳng một quan sát thử nghiệm, khỏi phải dựng cả buổi thi. */
async function addTrial(
  s: Awaited<ReturnType<typeof setup>>,
  opts: { n: number; correct: number; d: number; versionId?: string; key: string },
) {
  // Phiên bản chỉ được sinh khi câu được copy vào một đề (copyBankQuestionToExam).
  // Test này ghi thẳng quan sát nên phải tự dựng bản v1.
  const version = opts.versionId
    ? { id: opts.versionId }
    : ((await prisma.bankQuestionVersion.findFirst({
        where: { bankQuestionId: s.bankQuestionId },
        orderBy: { versionNumber: "desc" },
        select: { id: true },
      })) ??
      (await prisma.bankQuestionVersion.create({
        data: {
          bankQuestionId: s.bankQuestionId,
          versionNumber: 1,
          prompt: "Câu thử nghiệm",
          config: mcq(),
          points: 1,
        },
        select: { id: true },
      })));

  const exam = await prisma.exam.create({
    data: {
      courseId: s.courseId,
      title: `Đề thử ${opts.key}`,
      durationMin: 30,
      openAt: new Date(),
      closeAt: new Date(Date.now() + 86_400_000),
      purpose: "field_test",
    },
    select: { id: true },
  });
  const eq = await prisma.examQuestion.create({
    data: {
      examId: exam.id,
      type: "mcq",
      prompt: "x",
      config: mcq(),
      points: 1,
      orderInExam: 0,
    },
    select: { id: true },
  });
  await prisma.itemTrialStat.create({
    data: {
      examQuestionId: eq.id,
      bankQuestionId: s.bankQuestionId,
      bankQuestionVersionId: version.id,
      examId: exam.id,
      attemptCount: opts.n,
      correctCount: opts.correct,
      pValue: opts.correct / opts.n,
      discrimination: opts.d,
    },
  });
  return version.id;
}

describe("getItemTrialHistory", () => {
  it("giữ nguyên chuỗi từng đợt thay vì gộp thành một số", async () => {
    const s = await setup("series");
    await addTrial(s, { n: 40, correct: 10, d: 0.1, key: "a" });
    await addTrial(s, { n: 60, correct: 35, d: 0.3, key: "b" });

    const h = await getItemTrialHistory(s.ownerId, s.bankQuestionId);
    expect(h.points).toHaveLength(2);
    expect(h.points[0]!.attemptCount).toBe(40);
    expect(h.points[1]!.attemptCount).toBe(60);
  });

  it("cộng dồn theo phiên bản, tính p từ TỔNG chứ không lấy trung bình của các p", async () => {
    const s = await setup("pool");
    // p riêng lẻ: 10/40 = 0,25 và 35/60 ≈ 0,583. Trung bình của hai p là 0,417
    // — sai. Tỉ lệ đúng của tổng là 45/100 = 0,45.
    await addTrial(s, { n: 40, correct: 10, d: 0.1, key: "a" });
    await addTrial(s, { n: 60, correct: 35, d: 0.3, key: "b" });

    const h = await getItemTrialHistory(s.ownerId, s.bankQuestionId);
    expect(h.rollups).toHaveLength(1);
    expect(h.rollups[0]!.totalAttempts).toBe(100);
    expect(h.rollups[0]!.pValue).toBeCloseTo(0.45, 5);
    expect(h.rollups[0]!.pValue).not.toBeCloseTo(0.4167, 3);
  });

  it("KHÔNG gộp lẫn hai phiên bản câu chữ", async () => {
    const s = await setup("versions");
    const v1 = await addTrial(s, { n: 50, correct: 12, d: 0.1, key: "a" });

    // Sinh phiên bản mới rồi thử tiếp.
    const v2 = await prisma.bankQuestionVersion.create({
      data: {
        bankQuestionId: s.bankQuestionId,
        versionNumber: 2,
        prompt: "Câu đã sửa",
        config: mcq(),
        points: 1,
      },
      select: { id: true },
    });
    await addTrial(s, { n: 50, correct: 30, d: 0.35, versionId: v2.id, key: "b" });

    const h = await getItemTrialHistory(s.ownerId, s.bankQuestionId);
    expect(h.rollups).toHaveLength(2);
    const r1 = h.rollups.find((r) => r.versionId === v1)!;
    const r2 = h.rollups.find((r) => r.versionId === v2.id)!;
    expect(r1.pValue).toBeCloseTo(0.24, 5);
    expect(r2.pValue).toBeCloseTo(0.6, 5);
    // Phiên bản hiện hành là bản mới nhất.
    expect(h.currentRollup?.versionId).toBe(v2.id);
  });

  it("che số khi chưa đủ cỡ mẫu thay vì đưa ra con số vô trách nhiệm", async () => {
    const s = await setup("small");
    await addTrial(s, { n: 10, correct: 5, d: 0.4, key: "a" });

    const h = await getItemTrialHistory(s.ownerId, s.bankQuestionId);
    const r = h.currentRollup!;
    expect(r.totalAttempts).toBe(10);
    expect(r.enoughForP).toBe(false);
    expect(r.pValue).toBeNull();
    expect(r.discrimination).toBeNull();
  });
});

describe("cửa kết nạp", () => {
  it("chưa đủ mẫu thì chưa sẵn sàng, và nêu rõ lý do", async () => {
    const s = await setup("notready");
    await addTrial(s, { n: 10, correct: 5, d: 0.4, key: "a" });

    const h = await getItemTrialHistory(s.ownerId, s.bankQuestionId);
    const r = assessPromotionReadiness(h);
    expect(r.ready).toBe(false);
    expect(r.blockers.join(" ")).toContain(String(TRIAL_MIN_N.pValue));
  });

  it("đủ mẫu và chỉ số lành thì sẵn sàng", async () => {
    const s = await setup("ready");
    await addTrial(s, { n: 150, correct: 90, d: 0.35, key: "a" });

    const h = await getItemTrialHistory(s.ownerId, s.bankQuestionId);
    const r = assessPromotionReadiness(h);
    expect(r.ready).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("bắt được câu đảo dấu", async () => {
    const s = await setup("negd");
    await addTrial(s, { n: 150, correct: 80, d: -0.2, key: "a" });

    const h = await getItemTrialHistory(s.ownerId, s.bankQuestionId);
    const r = assessPromotionReadiness(h);
    expect(r.ready).toBe(false);
    expect(r.blockers.join(" ")).toContain("âm");
  });

  it("chặn kết nạp khi chưa đủ bằng chứng mà không ghi lý do", async () => {
    const s = await setup("noreason");
    await addTrial(s, { n: 10, correct: 5, d: 0.4, key: "a" });

    await expect(
      promoteBankQuestion(s.ownerId, s.bankQuestionId),
    ).rejects.toMatchObject({ code: "validation_failed" });

    const q = await prisma.bankQuestion.findUniqueOrThrow({
      where: { id: s.bankQuestionId },
    });
    expect(q.status).toBe("draft");
  });

  it("vẫn kết nạp được nếu GV ghi lý do — cảnh báo chứ không chặn cứng", async () => {
    const s = await setup("override");
    await addTrial(s, { n: 10, correct: 5, d: 0.4, key: "a" });

    const r = await promoteBankQuestion(s.ownerId, s.bankQuestionId, {
      reason: "Câu quan trọng về nội dung, chấp nhận mẫu nhỏ.",
    });
    expect(r.promoted).toBe(true);

    const q = await prisma.bankQuestion.findUniqueOrThrow({
      where: { id: s.bankQuestionId },
    });
    expect(q.status).toBe("published");
    // Lý do phải lưu lại, không thì sáu tháng sau không ai nhớ vì sao.
    expect(q.editNote).toContain("Câu quan trọng về nội dung");
    expect(q.reviewStatus).toBe("approved");
  });

  it("đủ bằng chứng thì kết nạp thẳng, không cần lý do", async () => {
    const s = await setup("clean");
    await addTrial(s, { n: 150, correct: 90, d: 0.35, key: "a" });

    const r = await promoteBankQuestion(s.ownerId, s.bankQuestionId);
    expect(r.promoted).toBe(true);
    const q = await prisma.bankQuestion.findUniqueOrThrow({
      where: { id: s.bankQuestionId },
    });
    expect(q.status).toBe("published");
    expect(q.editNote ?? "").not.toContain("chưa đủ bằng chứng");
  });
});
