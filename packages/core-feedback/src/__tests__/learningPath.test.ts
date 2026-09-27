import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType, lessonSkillCode } from "@feedbackme/shared-types";
import {
  getLearningPath,
  PathClickError,
  recordPathClick,
  recordPathShown,
} from "../learningPath";
import { updateLearnerStateFromAttempt } from "../learnerState";

/**
 * B4 (làm lại) — lộ trình cá nhân hoá. Nền là thứ tự bài GV sắp; cá nhân hoá
 * chèn "ôn lại" / "lướt qua" lên nền đó theo nhãn mức nắm vững của từng bài.
 */

interface Fx {
  userId: string;
  courseId: string;
  lessonIds: string[];
  skillIds: string[];
}

/** Khoá bật cá nhân hoá, `n` bài trong 1 chương, mỗi bài 1 chủ đề tự sinh. */
async function fx(
  slug: string,
  n: number,
  opts: { personalization?: boolean; variant?: "personalized" | "minimal"; enroll?: boolean } = {},
): Promise<Fx> {
  const course = await prisma.course.create({
    data: {
      slug: `lp-${slug}`,
      title: "C",
      description: "x",
      personalizationEnabled: opts.personalization ?? true,
    },
  });
  const mod = await prisma.module.create({
    data: { courseId: course.id, title: "Chương 1", orderIndex: 0 },
  });
  const lessonIds: string[] = [];
  const skillIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const lesson = await prisma.lesson.create({
      data: { moduleId: mod.id, title: `Bài ${i + 1}`, orderIndex: i },
    });
    const skill = await prisma.skill.create({
      data: { code: lessonSkillCode(lesson.id), name: `Bài ${i + 1}` },
    });
    await prisma.contentSkillMapping.create({
      data: { contentType: "lesson", contentId: lesson.id, skillId: skill.id, coverageWeight: 1 },
    });
    lessonIds.push(lesson.id);
    skillIds.push(skill.id);
  }
  const user = await prisma.user.create({
    data: { email: `lp-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  if (opts.enroll ?? true) {
    const section = await prisma.courseSection.create({
      data: { courseId: course.id, name: "Lớp", feedbackVariant: opts.variant ?? "personalized" },
    });
    await prisma.enrollment.create({
      data: { userId: user.id, courseId: course.id, sectionId: section.id, courseVersion: 1 },
    });
  }
  return { userId: user.id, courseId: course.id, lessonIds, skillIds };
}

async function complete(f: Fx, i: number) {
  await prisma.learningEvent.create({
    data: {
      userId: f.userId,
      courseId: f.courseId,
      eventType: LearningEventType.LessonCompleted,
      payload: { lessonId: f.lessonIds[i] },
    },
  });
}

async function mastery(f: Fx, i: number, p: number, skillId = f.skillIds[i]!) {
  await prisma.learnerSkillState.upsert({
    where: { userId_skillId: { userId: f.userId, skillId } },
    create: { userId: f.userId, skillId, masteryProbability: p, attempts: 3, correctCount: 1 },
    update: { masteryProbability: p },
  });
}

const summary = (steps: { kind: string; lessonId: string }[], f: Fx) =>
  steps.map((s) => `${s.kind}:${f.lessonIds.indexOf(s.lessonId) + 1}`);

describe("getLearningPath — thứ tự", () => {
  it("AC-2.4: ôn lại → học tiếp → luyện thêm → lướt qua, mỗi nhóm theo thứ tự khoá", async () => {
    const f = await fx("o1", 7);
    // Bài 1–4 đã học: 1 Nên luyện, 2 Cần ôn, 3 Vững, 4 Cần ôn.
    for (const i of [0, 1, 2, 3]) await complete(f, i);
    await mastery(f, 0, 0.7);
    await mastery(f, 1, 0.3);
    await mastery(f, 2, 0.9);
    await mastery(f, 3, 0.2);
    // Bài 6 chưa học nhưng đã làm quiz đạt Vững.
    await mastery(f, 5, 0.95);

    const path = await getLearningPath(f.userId, f.courseId);
    expect(path.enabled).toBe(true);
    // Bài 2 trước Bài 4 dù Bài 4 yếu hơn — kiến thức nền trước.
    expect(summary(path.steps, f)).toEqual([
      "review:2",
      "review:4",
      "next:5",
      "practice:1",
      "skim:6",
    ]);
    expect(path.steps[0]!.label).toBe("needs_review");
    expect(path.steps[0]!.completed).toBe(true);
    expect(path.steps[2]!.label).toBe("no_data");
  });

  it("AC-2.4: tối đa 5 bước", async () => {
    const f = await fx("o2", 8);
    for (let i = 0; i < 7; i++) {
      await complete(f, i);
      await mastery(f, i, 0.1);
    }
    const path = await getLearningPath(f.userId, f.courseId);
    expect(path.steps).toHaveLength(5);
    expect(path.steps.every((s) => s.kind === "review")).toBe(true);
  });

  it("bài học tiếp đã Vững thì thành 'lướt qua', bài chưa học kế sau mới là 'học tiếp'", async () => {
    const f = await fx("o3", 3);
    await mastery(f, 0, 0.9);
    const path = await getLearningPath(f.userId, f.courseId);
    expect(summary(path.steps, f)).toEqual(["next:2", "skim:1"]);
  });

  it("AC-2.6: bài chưa có dữ liệu không bao giờ bị gợi ý ôn lại", async () => {
    const f = await fx("o4", 3);
    await complete(f, 0);
    await complete(f, 1);
    const path = await getLearningPath(f.userId, f.courseId);
    expect(summary(path.steps, f)).toEqual(["next:3"]);
    expect(path.labels[f.lessonIds[0]!]).toBe("no_data");
  });

  it("học hết khoá và mọi bài Vững → lộ trình rỗng", async () => {
    const f = await fx("o5", 2);
    for (const i of [0, 1]) {
      await complete(f, i);
      await mastery(f, i, 0.9);
    }
    expect((await getLearningPath(f.userId, f.courseId)).steps).toEqual([]);
  });
});

describe("getLearningPath — bài ẩn, khoá, nhiều chủ đề", () => {
  it("bỏ qua bài ẩn, chương ẩn, và bài đang khoá", async () => {
    const f = await fx("h1", 4);
    await prisma.lesson.update({ where: { id: f.lessonIds[0]! }, data: { isHidden: true } });
    await prisma.lesson.update({ where: { id: f.lessonIds[1]! }, data: { isLocked: true } });
    const hiddenMod = await prisma.module.create({
      data: { courseId: f.courseId, title: "Ẩn", orderIndex: 1, isHidden: true },
    });
    await prisma.lesson.update({ where: { id: f.lessonIds[3]! }, data: { moduleId: hiddenMod.id } });

    const path = await getLearningPath(f.userId, f.courseId);
    expect(summary(path.steps, f)).toEqual(["next:3"]);
  });

  it("AC-2.1: bài nhiều chủ đề lấy chủ đề thấp nhất; lướt qua cần đủ dữ liệu mọi chủ đề", async () => {
    const f = await fx("m1", 2);
    const extra = await prisma.skill.create({ data: { code: "skill.m1.extra", name: "Thêm" } });
    await prisma.contentSkillMapping.create({
      data: { contentType: "lesson", contentId: f.lessonIds[0]!, skillId: extra.id, coverageWeight: 1 },
    });

    // Chủ đề tự sinh Vững, chủ đề thêm chưa có dữ liệu → chưa đủ căn cứ để lướt.
    await mastery(f, 0, 0.95);
    let path = await getLearningPath(f.userId, f.courseId);
    expect(summary(path.steps, f)).toEqual(["next:1"]);
    expect(path.labels[f.lessonIds[0]!]).toBe("solid");

    // Chủ đề thêm yếu → nhãn bài là Cần ôn.
    await mastery(f, 0, 0.3, extra.id);
    await complete(f, 0);
    path = await getLearningPath(f.userId, f.courseId);
    expect(path.labels[f.lessonIds[0]!]).toBe("needs_review");
    expect(summary(path.steps, f)).toEqual(["review:1", "next:2"]);
  });
});

describe("getLearningPath — khi nào tắt", () => {
  it("AC-2.8: lớp đối chứng không có lộ trình", async () => {
    const f = await fx("d1", 2, { variant: "minimal" });
    await complete(f, 0);
    await mastery(f, 0, 0.1);
    const path = await getLearningPath(f.userId, f.courseId);
    expect(path).toMatchObject({ enabled: false, reason: "control_variant", steps: [] });
  });

  it("AC-2.8: khoá tắt cá nhân hoá không có lộ trình", async () => {
    const f = await fx("d2", 2, { personalization: false });
    const path = await getLearningPath(f.userId, f.courseId);
    expect(path).toMatchObject({ enabled: false, reason: "personalization_off", steps: [] });
  });

  it("AC-2.16: chưa ghi danh thì không có lộ trình", async () => {
    const f = await fx("d3", 2, { enroll: false });
    const path = await getLearningPath(f.userId, f.courseId);
    expect(path).toMatchObject({ enabled: false, reason: "not_enrolled", steps: [] });
  });

  it("lớp personalized có lộ trình", async () => {
    const f = await fx("d4", 2, { variant: "personalized" });
    expect((await getLearningPath(f.userId, f.courseId)).enabled).toBe(true);
  });
});

describe("recordPathShown / recordPathClick", () => {
  it("AC-2.13: mỗi (bài, loại, nơi hiện) chỉ ghi 1 event 'shown' mỗi ngày", async () => {
    const f = await fx("e1", 2);
    await complete(f, 0);
    await mastery(f, 0, 0.2);
    const { steps } = await getLearningPath(f.userId, f.courseId);

    await recordPathShown(f.userId, f.courseId, steps, "course_home");
    await recordPathShown(f.userId, f.courseId, steps, "course_home");
    await recordPathShown(f.userId, f.courseId, steps, "quiz_result");

    const rows = await prisma.learningEvent.findMany({
      where: { userId: f.userId, eventType: LearningEventType.AdaptivePathUpdated },
    });
    expect(rows).toHaveLength(4); // 2 bước × 2 nơi hiện
    // Nhãn đổi trong ngày → ghi thêm, vì đó là tín hiệu thật.
    await mastery(f, 0, 0.7);
    const again = await getLearningPath(f.userId, f.courseId);
    await recordPathShown(f.userId, f.courseId, again.steps, "course_home");
    expect(
      await prisma.learningEvent.count({
        where: { userId: f.userId, eventType: LearningEventType.AdaptivePathUpdated },
      }),
    ).toBe(5); // + "luyện thêm: Bài 1"; "học tiếp: Bài 2" trùng khoá nên không ghi lại
    expect(rows[0]!.payload).toMatchObject({
      action: "shown",
      suggestionType: "review",
      targetLessonId: f.lessonIds[0],
      surface: "course_home",
      label: "needs_review",
      position: 0,
    });
  });

  it("AC-2.14: bấm vào bước đã hiện thì ghi 'clicked'", async () => {
    const f = await fx("e2", 2);
    const { steps } = await getLearningPath(f.userId, f.courseId);
    await recordPathShown(f.userId, f.courseId, steps, "course_home");

    await recordPathClick(f.userId, f.lessonIds[0]!, "course_home", "next");
    const clicked = await prisma.learningEvent.findMany({
      where: {
        userId: f.userId,
        eventType: LearningEventType.AdaptivePathUpdated,
        payload: { path: ["action"], equals: "clicked" },
      },
    });
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.courseId).toBe(f.courseId);
  });

  it("không ghi 'clicked' cho bài chưa từng được gợi ý — chống bơm dữ liệu uptake", async () => {
    const f = await fx("e3", 2);
    await expect(
      recordPathClick(f.userId, f.lessonIds[1]!, "course_home", "next"),
    ).rejects.toBeInstanceOf(PathClickError);
  });
});

describe("AC-2.17 — đầu-cuối qua BKT thật", () => {
  it("trượt quiz → Cần ôn → làm lại đạt → rời nhóm ôn lại", async () => {
    const f = await fx("x1", 2);
    const quiz = await prisma.quiz.create({
      data: { courseId: f.courseId, lessonId: f.lessonIds[0], title: "Q1" },
    });
    const questions: { id: string }[] = [];
    for (let i = 0; i < 4; i++) {
      const q = await prisma.quizQuestion.create({
        data: { quizId: quiz.id, type: "mcq", prompt: `p${i}`, points: 1, orderIndex: i },
      });
      await prisma.questionSkillTag.create({ data: { questionId: q.id, skillId: f.skillIds[0]! } });
      questions.push(q);
    }
    async function attempt(correct: boolean) {
      const a = await prisma.quizAttempt.create({
        data: { quizId: quiz.id, userId: f.userId, status: "submitted" },
      });
      for (const q of questions) {
        await prisma.answerResponse.create({
          data: { attemptId: a.id, questionId: q.id, response: [], isCorrect: correct, responseTimeMs: 100 },
        });
      }
      await updateLearnerStateFromAttempt(f.userId, a.id);
    }

    await complete(f, 0);
    await attempt(false);
    let path = await getLearningPath(f.userId, f.courseId);
    expect(summary(path.steps, f)).toEqual(["review:1", "next:2"]);

    await attempt(true);
    path = await getLearningPath(f.userId, f.courseId);
    expect(path.labels[f.lessonIds[0]!]).toBe("solid");
    expect(summary(path.steps, f)).toEqual(["next:2"]);
  });
});
