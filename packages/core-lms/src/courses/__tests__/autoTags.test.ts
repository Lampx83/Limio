import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { lessonSkillCode } from "@feedbackme/shared-types";
import { createCourse, updateCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson, deleteLesson, duplicateLesson, updateLesson } from "../lessons";
import { createSkill } from "../skills";
import { backfillCourseTags } from "../autoTags";
import { createQuiz } from "../../quizzes/quizzes";
import { createQuestion, tagQuestionSkill, updateQuestion } from "../../quizzes/questions";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function makeUser(email: string) {
  const r = await registerUser(
    { email, password: "password1234", displayName: email },
    BASE,
  );
  return r.userId;
}

async function makeCourse(
  ownerId: string,
  slug: string,
  personalizationEnabled = true,
) {
  const c = await createCourse(ownerId, {
    title: "Auto tag course",
    description: "Course used by the B1.5 auto-tag tests.",
    slug,
    personalizationEnabled,
  });
  const m = await createModule(ownerId, c.courseId, { title: "Chương 1", orderIndex: 0 });
  return { courseId: c.courseId, moduleId: m.moduleId };
}

async function lessonTag(lessonId: string) {
  return prisma.skill.findUnique({ where: { code: lessonSkillCode(lessonId) } });
}

/** MCQ payload — one right answer, one wrong. */
function mcq(orderIndex = 0) {
  return {
    type: "mcq" as const,
    prompt: "1 + 1 = ?",
    orderIndex,
    options: [
      { label: "2", isCorrect: true },
      { label: "3", isCorrect: false },
    ],
  };
}

describe("B1.5 — lesson tag lifecycle", () => {
  it("AC-1.1: creating a lesson provisions its skill + content mapping", async () => {
    const ownerId = await makeUser("at-create@example.com");
    const { moduleId } = await makeCourse(ownerId, "at-create");
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Hồi quy tuyến tính",
      orderIndex: 0,
    });

    const skill = await lessonTag(lessonId);
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("Hồi quy tuyến tính");

    const mapping = await prisma.contentSkillMapping.findFirst({
      where: { contentType: "lesson", contentId: lessonId, skillId: skill!.id },
    });
    expect(mapping).not.toBeNull();
    expect(mapping!.coverageWeight).toBe(1);
  });

  it("AC-1.2: renaming a lesson renames its tag, keeps the code", async () => {
    const ownerId = await makeUser("at-rename@example.com");
    const { moduleId } = await makeCourse(ownerId, "at-rename");
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Tên cũ",
      orderIndex: 0,
    });

    await updateLesson(ownerId, lessonId, { title: "Tên mới" });

    const skill = await lessonTag(lessonId);
    expect(skill!.name).toBe("Tên mới");
    expect(skill!.code).toBe(lessonSkillCode(lessonId));
  });

  it("AC-1.3: deleting a lesson removes its tag and learner state", async () => {
    const ownerId = await makeUser("at-delete@example.com");
    const { moduleId } = await makeCourse(ownerId, "at-delete");
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Sắp xoá",
      orderIndex: 0,
    });
    const skill = await lessonTag(lessonId);
    await prisma.learnerSkillState.create({
      data: { userId: ownerId, skillId: skill!.id, masteryProbability: 0.4, attempts: 3 },
    });

    await deleteLesson(ownerId, lessonId);

    expect(await lessonTag(lessonId)).toBeNull();
    expect(
      await prisma.learnerSkillState.count({ where: { skillId: skill!.id } }),
    ).toBe(0);
  });

  it("AC-1.4: a plain LMS course provisions nothing", async () => {
    const ownerId = await makeUser("at-off@example.com");
    const { moduleId } = await makeCourse(ownerId, "at-off", false);
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Không tag",
      orderIndex: 0,
    });

    expect(await lessonTag(lessonId)).toBeNull();
    expect(
      await prisma.contentSkillMapping.count({
        where: { contentType: "lesson", contentId: lessonId },
      }),
    ).toBe(0);
  });

  it("AC-1.5: turning personalization on backfills existing lessons", async () => {
    const ownerId = await makeUser("at-flip@example.com");
    const { courseId, moduleId } = await makeCourse(ownerId, "at-flip", false);
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Bài cũ",
      orderIndex: 0,
    });
    const quiz = await createQuiz(ownerId, { courseId, lessonId }, { title: "Q" });
    const { questionId } = await createQuestion(ownerId, quiz.quizId, mcq());
    expect(await lessonTag(lessonId)).toBeNull();

    await updateCourse(ownerId, courseId, { personalizationEnabled: true });

    const skill = await lessonTag(lessonId);
    expect(skill).not.toBeNull();
    const tags = await prisma.questionSkillTag.findMany({ where: { questionId } });
    expect(tags.map((t) => t.skillId)).toEqual([skill!.id]);
  });

  it("duplicating a lesson mints a fresh tag rather than sharing the source's", async () => {
    const ownerId = await makeUser("at-dup@example.com");
    const { courseId, moduleId } = await makeCourse(ownerId, "at-dup");
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Bài gốc",
      orderIndex: 0,
    });
    const quiz = await createQuiz(ownerId, { courseId, lessonId }, { title: "Q" });
    await createQuestion(ownerId, quiz.quizId, mcq());

    const dup = await duplicateLesson(ownerId, lessonId);

    const srcSkill = await lessonTag(lessonId);
    const dupSkill = await lessonTag(dup.lessonId);
    expect(dupSkill).not.toBeNull();
    expect(dupSkill!.id).not.toBe(srcSkill!.id);

    // The clone's questions point at the clone's tag, not the original's.
    const dupTags = await prisma.questionSkillTag.findMany({
      where: { question: { quiz: { lessonId: dup.lessonId } } },
    });
    expect(dupTags).toHaveLength(1);
    expect(dupTags[0]!.skillId).toBe(dupSkill!.id);
  });
});

describe("B1.5 — question tag inheritance", () => {
  it("AC-2.1: a new question inherits its lesson's tag", async () => {
    const ownerId = await makeUser("at-q-inherit@example.com");
    const { courseId, moduleId } = await makeCourse(ownerId, "at-q-inherit");
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Bài có quiz",
      orderIndex: 0,
    });
    const quiz = await createQuiz(ownerId, { courseId, lessonId }, { title: "Q" });

    const { questionId } = await createQuestion(ownerId, quiz.quizId, mcq());

    const skill = await lessonTag(lessonId);
    const tags = await prisma.questionSkillTag.findMany({ where: { questionId } });
    expect(tags.map((t) => t.skillId)).toEqual([skill!.id]);
  });

  it("AC-2.2: a hand-authored tag wins — at create and when added later", async () => {
    const ownerId = await makeUser("at-q-manual@example.com");
    const { courseId, moduleId } = await makeCourse(ownerId, "at-q-manual");
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Bài tag tay",
      orderIndex: 0,
    });
    const quiz = await createQuiz(ownerId, { courseId, lessonId }, { title: "Q" });
    const authored = await createSkill({ code: "skill.authored", name: "Do GV tạo" });

    // Provided at create → auto tag never added.
    const explicit = await createQuestion(ownerId, quiz.quizId, {
      ...mcq(0),
      skillIds: [authored.skillId],
    });
    const explicitTags = await prisma.questionSkillTag.findMany({
      where: { questionId: explicit.questionId },
    });
    expect(explicitTags.map((t) => t.skillId)).toEqual([authored.skillId]);

    // Added afterwards → the auto tag steps aside so BKT isn't fed twice.
    const inherited = await createQuestion(ownerId, quiz.quizId, mcq(1));
    await tagQuestionSkill(ownerId, inherited.questionId, authored.skillId);
    const afterTags = await prisma.questionSkillTag.findMany({
      where: { questionId: inherited.questionId },
    });
    expect(afterTags.map((t) => t.skillId)).toEqual([authored.skillId]);
  });

  it("clearing every authored tag falls back to the lesson tag", async () => {
    const ownerId = await makeUser("at-q-clear@example.com");
    const { courseId, moduleId } = await makeCourse(ownerId, "at-q-clear");
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Bài xoá tag",
      orderIndex: 0,
    });
    const quiz = await createQuiz(ownerId, { courseId, lessonId }, { title: "Q" });
    const authored = await createSkill({ code: "skill.temp", name: "Tạm" });
    const { questionId } = await createQuestion(ownerId, quiz.quizId, {
      ...mcq(),
      skillIds: [authored.skillId],
    });

    await updateQuestion(ownerId, questionId, { skillIds: [] });

    const skill = await lessonTag(lessonId);
    const tags = await prisma.questionSkillTag.findMany({ where: { questionId } });
    expect(tags.map((t) => t.skillId)).toEqual([skill!.id]);
  });

  it("AC-2.3: a standalone quiz gets no auto tag", async () => {
    const ownerId = await makeUser("at-q-standalone@example.com");
    const { courseId } = await makeCourse(ownerId, "at-q-standalone");
    const quiz = await createQuiz(ownerId, { courseId }, { title: "Quiz rời" });

    const { questionId } = await createQuestion(ownerId, quiz.quizId, mcq());

    expect(await prisma.questionSkillTag.count({ where: { questionId } })).toBe(0);
  });
});

describe("B1.5 — backfill", () => {
  it("AC-3.2: is idempotent — a second run creates nothing", async () => {
    const ownerId = await makeUser("at-backfill@example.com");
    const { courseId, moduleId } = await makeCourse(ownerId, "at-backfill", false);
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Bài chưa tag",
      orderIndex: 0,
    });
    const quiz = await createQuiz(ownerId, { courseId, lessonId }, { title: "Q" });
    await createQuestion(ownerId, quiz.quizId, mcq());

    const first = await backfillCourseTags(courseId, { force: true });
    expect(first).toEqual({
      skillsCreated: 1,
      mappingsCreated: 1,
      questionTagsCreated: 1,
    });

    const second = await backfillCourseTags(courseId, { force: true });
    expect(second).toEqual({
      skillsCreated: 0,
      mappingsCreated: 0,
      questionTagsCreated: 0,
    });
  });

  it("AC-5.1: skips courses that run as a plain LMS", async () => {
    const ownerId = await makeUser("at-backfill-off@example.com");
    const { courseId, moduleId } = await makeCourse(ownerId, "at-backfill-off", false);
    await createLesson(ownerId, moduleId, { title: "Bài", orderIndex: 0 });

    const stats = await backfillCourseTags(courseId);

    expect(stats).toEqual({
      skillsCreated: 0,
      mappingsCreated: 0,
      questionTagsCreated: 0,
    });
  });

  it("AC-5.2: leaves instructor-authored skills alone", async () => {
    const ownerId = await makeUser("at-authored@example.com");
    const { courseId, moduleId } = await makeCourse(ownerId, "at-authored");
    const { lessonId } = await createLesson(ownerId, moduleId, {
      title: "Bài",
      orderIndex: 0,
    });
    const authored = await createSkill({ code: "skill.kept", name: "Giữ nguyên" });
    await prisma.contentSkillMapping.create({
      data: { contentType: "lesson", contentId: lessonId, skillId: authored.skillId },
    });

    await backfillCourseTags(courseId);
    await deleteLesson(ownerId, lessonId);

    // Deleting the lesson drops its auto tag but never the authored one.
    const still = await prisma.skill.findUnique({ where: { id: authored.skillId } });
    expect(still).not.toBeNull();
  });
});
