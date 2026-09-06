import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { generateDiagnosticFeedback } from "../diagnostic";
import { getAdaptiveNextLesson } from "../adaptivePath";
import { resolveFeedbackVariant } from "../variant";

/**
 * B10 — điều kiện thực nghiệm theo lớp. Kiểm chứng đúng một câu hỏi: hai người
 * học trả lời SAI HỆT NHAU trên cùng một câu, chỉ khác lớp, thì nhận gì?
 *
 * Cách dựng dữ liệu cố ý bố trí sao cho lớp `personalized` chắc chắn có đủ
 * nguyên liệu để cá nhân hoá (đáp án sai có gắn misconception, có template
 * riêng, có bài ôn cùng skill chưa học). Nếu không thì phép so sánh vô nghĩa —
 * lớp đối chứng "không nhận gì" chỉ vì chẳng có gì để nhận.
 */

interface Fixture {
  courseId: string;
  quizId: string;
  questionId: string;
  optWrong: string;
  lessonId: string;
  sectionPersonalized: string;
  sectionMinimal: string;
}

async function fixture(slug: string): Promise<Fixture> {
  const course = await prisma.course.create({
    data: { slug: `v-${slug}`, title: "C", description: "x" },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "M", orderIndex: 0 },
  });
  const lesson = await prisma.lesson.create({
    data: { moduleId: mod.id, title: "Bài ôn", orderIndex: 0 },
  });
  const skill = await prisma.skill.create({
    data: { code: `skill.v.${slug}`, name: "S" },
  });
  await prisma.contentSkillMapping.create({
    data: {
      contentType: "lesson",
      contentId: lesson.id,
      skillId: skill.id,
      coverageWeight: 0.9,
    },
  });
  const misconception = await prisma.misconception.create({
    data: { code: `mc-v-${slug}`, name: "MC", description: "x" },
  });
  await prisma.feedbackTemplate.create({
    data: {
      scope: "per_misconception",
      misconceptionId: misconception.id,
      body: "Bạn đang nhầm khái niệm A với B.",
    },
  });
  const quiz = await prisma.quiz.create({
    data: { courseId: course.id, title: "Q" },
  });
  const question = await prisma.quizQuestion.create({
    data: { quizId: quiz.id, type: "mcq", prompt: "p", points: 1, orderIndex: 0 },
  });
  await prisma.questionSkillTag.create({
    data: { questionId: question.id, skillId: skill.id },
  });
  await prisma.questionOption.create({
    data: { questionId: question.id, label: "right", isCorrect: true, orderIndex: 0 },
  });
  const optWrong = await prisma.questionOption.create({
    data: {
      questionId: question.id,
      label: "wrong",
      isCorrect: false,
      misconceptionId: misconception.id,
      orderIndex: 1,
    },
  });
  const secP = await prisma.courseSection.create({
    data: { courseId: course.id, name: "Lớp 1", feedbackVariant: "personalized" },
  });
  const secM = await prisma.courseSection.create({
    data: { courseId: course.id, name: "Lớp 2", feedbackVariant: "minimal" },
  });
  return {
    courseId: course.id,
    quizId: quiz.id,
    questionId: question.id,
    optWrong: optWrong.id,
    lessonId: lesson.id,
    sectionPersonalized: secP.id,
    sectionMinimal: secM.id,
  };
}

/** Một người học ở `sectionId`, trả lời sai câu đó, đã chấm xong. */
async function learnerWhoAnsweredWrong(
  f: Fixture,
  sectionId: string | null,
  slug: string,
): Promise<{ userId: string; attemptId: string }> {
  const user = await prisma.user.create({
    data: { email: `v-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  if (sectionId) {
    await prisma.enrollment.create({
      data: { userId: user.id, courseId: f.courseId, sectionId, courseVersion: 1 },
    });
  }
  const attempt = await prisma.quizAttempt.create({
    data: { quizId: f.quizId, userId: user.id, status: "submitted" },
  });
  await prisma.answerResponse.create({
    data: {
      attemptId: attempt.id,
      questionId: f.questionId,
      response: [f.optWrong],
      isCorrect: false,
      responseTimeMs: 100,
    },
  });
  return { userId: user.id, attemptId: attempt.id };
}

describe("resolveFeedbackVariant", () => {
  it("AC-2.3: chưa ghi danh thì mặc định personalized", async () => {
    const f = await fixture("r1");
    const user = await prisma.user.create({
      data: { email: "v-r1-none@e.com", passwordHash: "x", displayName: "n" },
    });
    const r = await resolveFeedbackVariant(user.id, f.courseId);
    expect(r).toEqual({ variant: "personalized", sectionId: null });
  });

  it("đọc điều kiện từ lớp của người học", async () => {
    const f = await fixture("r2");
    const p = await learnerWhoAnsweredWrong(f, f.sectionPersonalized, "r2p");
    const m = await learnerWhoAnsweredWrong(f, f.sectionMinimal, "r2m");
    expect(await resolveFeedbackVariant(p.userId, f.courseId)).toEqual({
      variant: "personalized",
      sectionId: f.sectionPersonalized,
    });
    expect(await resolveFeedbackVariant(m.userId, f.courseId)).toEqual({
      variant: "minimal",
      sectionId: f.sectionMinimal,
    });
  });
});

describe("generateDiagnosticFeedback — điều kiện theo lớp", () => {
  it("AC-2.1/2.2/2.4: cùng một đáp án sai, hai lớp nhận hai loại feedback", async () => {
    const f = await fixture("g1");
    const p = await learnerWhoAnsweredWrong(f, f.sectionPersonalized, "g1p");
    const m = await learnerWhoAnsweredWrong(f, f.sectionMinimal, "g1m");

    const rp = await generateDiagnosticFeedback(p.userId, p.attemptId);
    const rm = await generateDiagnosticFeedback(m.userId, m.attemptId);

    // AC-2.4 — cả hai nhóm đều có delivery; điều kiện đổi nội dung, không bỏ qua.
    expect(rp.deliveries).toHaveLength(1);
    expect(rm.deliveries).toHaveLength(1);

    // AC-2.2 — lớp cá nhân hoá: gọi tên misconception + có bài ôn.
    expect(rp.deliveries[0]!.misconceptionCode).toBe(`mc-v-g1`);
    expect(rp.deliveries[0]!.remediationLessonIds).toEqual([f.lessonId]);
    expect(rp.deliveries[0]!.body).toContain("nhầm khái niệm");

    // AC-2.1 — lớp đối chứng: không misconception, không bài ôn, dù đáp án sai
    // họ chọn có gắn misconception và bài ôn vẫn tồn tại.
    expect(rm.deliveries[0]!.misconceptionCode).toBeNull();
    expect(rm.deliveries[0]!.remediationLessonIds).toEqual([]);
    expect(rm.deliveries[0]!.body).not.toContain("nhầm khái niệm");
  });

  it("AC-2.1: toạ độ SSMMD của lớp đối chứng dừng ở tầng task", async () => {
    const f = await fixture("g2");
    const m = await learnerWhoAnsweredWrong(f, f.sectionMinimal, "g2m");
    await generateDiagnosticFeedback(m.userId, m.attemptId);

    const d = await prisma.feedbackDelivery.findFirstOrThrow({
      where: { userId: m.userId },
    });
    expect(d.level).toBe("task");
    expect(d.levels).toEqual(["task"]);
    expect(d.sourceKind).toBe("rule_template");
  });

  it("AC-3.1/3.2: generationContext mang điều kiện + lớp lúc sinh", async () => {
    const f = await fixture("g3");
    const m = await learnerWhoAnsweredWrong(f, f.sectionMinimal, "g3m");
    await generateDiagnosticFeedback(m.userId, m.attemptId);

    const d = await prisma.feedbackDelivery.findFirstOrThrow({
      where: { userId: m.userId },
    });
    const ctx = d.generationContext as {
      feedbackVariant?: string;
      sectionId?: string | null;
    };
    expect(ctx.feedbackVariant).toBe("minimal");
    expect(ctx.sectionId).toBe(f.sectionMinimal);

    // Chuyển lớp sau đó KHÔNG viết lại dữ liệu cũ — đó là lý do điều kiện được
    // ghi lên delivery thay vì suy ngược từ Enrollment lúc phân tích.
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: m.userId, courseId: f.courseId } },
      data: { sectionId: f.sectionPersonalized },
    });
    const after = await prisma.feedbackDelivery.findUniqueOrThrow({
      where: { id: d.id },
    });
    expect(
      (after.generationContext as { feedbackVariant?: string }).feedbackVariant,
    ).toBe("minimal");
  });
});

describe("getAdaptiveNextLesson — kênh cá nhân hoá thứ hai", () => {
  it("AC-4.1: lớp đối chứng không được đề xuất bài kế tiếp", async () => {
    const f = await fixture("a1");
    const p = await learnerWhoAnsweredWrong(f, f.sectionPersonalized, "a1p");
    const m = await learnerWhoAnsweredWrong(f, f.sectionMinimal, "a1m");

    // Cả hai đều có một skill yếu như nhau.
    const skill = await prisma.skill.findFirstOrThrow({
      where: { code: "skill.v.a1" },
    });
    for (const u of [p.userId, m.userId]) {
      await prisma.learnerSkillState.create({
        data: {
          userId: u,
          skillId: skill.id,
          masteryProbability: 0.2,
          attempts: 3,
          correctCount: 0,
        },
      });
    }

    expect(await getAdaptiveNextLesson(p.userId, f.courseId)).not.toBeNull();
    expect(await getAdaptiveNextLesson(m.userId, f.courseId)).toBeNull();
  });
});
