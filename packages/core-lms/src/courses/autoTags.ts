/**
 * B1.5 — Lesson-as-tag auto-provisioning.
 *
 * Personalization needs every lesson and question to carry a skill tag, but
 * asking instructors to model a skill graph by hand is the single biggest
 * reason the Feedback Engine ships empty (spec §9 risk "Instructor không tag
 * skill chi tiết → personalization yếu"). So instead of a graph, we derive a
 * flat tag from the structure the instructor already built: one Skill per
 * Lesson, and questions inherit the tag of their quiz's lesson.
 *
 * What lands in the DB are ordinary `ContentSkillMapping` / `QuestionSkillTag`
 * rows — core-feedback (BKT, diagnostic, adaptive path) reads them unchanged.
 *
 * Auto tags are recognised by their `lesson.<lessonId>` code, so skills an
 * instructor authored by hand are never touched, listed, or deleted here.
 *
 * Every function is a no-op when the owning course has
 * `personalizationEnabled = false` — a plain LMS course accumulates no rows.
 */

import { prisma } from "@feedbackme/db";
import {
  AUTO_LESSON_SKILL_PREFIX,
  isAutoLessonSkillCode,
  lessonSkillCode,
} from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";

// The code convention is shared with core-feedback, which reads these rows and
// must not import core-lms (§4.3 module boundary).
export { AUTO_LESSON_SKILL_PREFIX, isAutoLessonSkillCode, lessonSkillCode };

const AUTO_SKILL_DESCRIPTION =
  "Chủ đề tự sinh từ bài học (B1.5). Xoá bài học sẽ xoá chủ đề này.";

export interface EnsureTagResult {
  skillId: string;
  createdSkill: boolean;
  createdMapping: boolean;
}

/**
 * Upsert the Skill + ContentSkillMapping pair for a lesson. Caller is
 * responsible for the personalization check — use `ensureLessonTag` unless you
 * already know the flag is on (e.g. inside a course-wide backfill).
 */
async function provisionLessonTag(
  lessonId: string,
  title: string,
  db: DbClient,
): Promise<EnsureTagResult> {
  const code = lessonSkillCode(lessonId);

  const existingSkill = await db.skill.findUnique({
    where: { code },
    select: { id: true },
  });
  const skill = existingSkill
    ? await db.skill.update({ where: { code }, data: { name: title }, select: { id: true } })
    : await db.skill.create({
        data: { code, name: title, description: AUTO_SKILL_DESCRIPTION },
        select: { id: true },
      });

  const mappingKey = {
    contentType: "lesson" as const,
    contentId: lessonId,
    skillId: skill.id,
  };
  const existingMapping = await db.contentSkillMapping.findUnique({
    where: { contentType_contentId_skillId: mappingKey },
    select: { id: true },
  });
  if (!existingMapping) {
    await db.contentSkillMapping.create({ data: { ...mappingKey, coverageWeight: 1.0 } });
  }

  return {
    skillId: skill.id,
    createdSkill: !existingSkill,
    createdMapping: !existingMapping,
  };
}

/**
 * AC-1.1 — make sure a lesson carries its auto tag. Returns null (no-op) when
 * the lesson is gone or its course runs as a plain LMS.
 */
export async function ensureLessonTag(
  lessonId: string,
  db: DbClient = prisma,
): Promise<string | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      module: { select: { course: { select: { personalizationEnabled: true } } } },
    },
  });
  if (!lesson || !lesson.module.course.personalizationEnabled) return null;
  const { skillId } = await provisionLessonTag(lesson.id, lesson.title, db);
  return skillId;
}

/** AC-1.2 — keep the tag's display name in step with the lesson title. */
export async function syncLessonTagName(
  lessonId: string,
  title: string,
  db: DbClient = prisma,
): Promise<void> {
  await db.skill.updateMany({
    where: { code: lessonSkillCode(lessonId) },
    data: { name: title },
  });
}

/**
 * AC-1.3 — drop a lesson's auto tag and everything hanging off it. Learner
 * mastery for the tag goes with it (derived state, rebuildable from
 * LearningEvent); instructor-authored skills are untouched.
 */
export async function removeLessonTag(
  lessonId: string,
  db: DbClient = prisma,
): Promise<void> {
  const skill = await db.skill.findUnique({
    where: { code: lessonSkillCode(lessonId) },
    select: { id: true },
  });
  if (!skill) return;
  await db.contentSkillMapping.deleteMany({ where: { skillId: skill.id } });
  await db.questionSkillTag.deleteMany({ where: { skillId: skill.id } });
  await db.skill.delete({ where: { id: skill.id } });
}

/**
 * AC-2.1..2.3 — give a question the tag of its quiz's lesson.
 *
 * No-ops when: the question already carries any tag (a hand-authored tag always
 * wins), the quiz is standalone rather than lesson-attached, or personalization
 * is off for the course.
 */
export async function ensureQuestionTag(
  questionId: string,
  db: DbClient = prisma,
): Promise<string | null> {
  const question = await db.quizQuestion.findUnique({
    where: { id: questionId },
    select: {
      skillTags: { select: { skillId: true }, take: 1 },
      quiz: { select: { lessonId: true } },
    },
  });
  if (!question) return null;
  if (question.skillTags.length > 0) return null;
  if (!question.quiz.lessonId) return null;

  const skillId = await ensureLessonTag(question.quiz.lessonId, db);
  if (!skillId) return null;

  await db.questionSkillTag.create({ data: { questionId, skillId, weight: 1.0 } });
  return skillId;
}

/**
 * Drop the auto tag from a question that just received a hand-authored one, so
 * the two don't both feed BKT. Called from `tagQuestionSkill`.
 */
export async function dropAutoTagFromQuestion(
  questionId: string,
  keepSkillId: string,
  db: DbClient = prisma,
): Promise<void> {
  const autoTags = await db.questionSkillTag.findMany({
    where: {
      questionId,
      skillId: { not: keepSkillId },
      skill: { code: { startsWith: AUTO_LESSON_SKILL_PREFIX } },
    },
    select: { skillId: true },
  });
  if (autoTags.length === 0) return;
  await db.questionSkillTag.deleteMany({
    where: { questionId, skillId: { in: autoTags.map((t) => t.skillId) } },
  });
}

export interface BackfillStats {
  skillsCreated: number;
  mappingsCreated: number;
  questionTagsCreated: number;
}

/**
 * AC-1.5 / AC-3.1 / AC-3.2 — provision tags for every lesson and lesson-attached
 * question in a course. Idempotent: a second run reports all-zero.
 *
 * Skips entirely when personalization is off, unless `force` is set (used right
 * after flipping the flag on, inside the same transaction as the flip).
 */
export async function backfillCourseTags(
  courseId: string,
  opts: { force?: boolean } = {},
  db: DbClient = prisma,
): Promise<BackfillStats> {
  const stats: BackfillStats = {
    skillsCreated: 0,
    mappingsCreated: 0,
    questionTagsCreated: 0,
  };

  if (!opts.force) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { personalizationEnabled: true },
    });
    if (!course?.personalizationEnabled) return stats;
  }

  const lessons = await db.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });

  for (const lesson of lessons) {
    const result = await provisionLessonTag(lesson.id, lesson.title, db);
    if (result.createdSkill) stats.skillsCreated += 1;
    if (result.createdMapping) stats.mappingsCreated += 1;

    const untagged = await db.quizQuestion.findMany({
      where: { quiz: { lessonId: lesson.id }, skillTags: { none: {} } },
      select: { id: true },
    });
    if (untagged.length > 0) {
      const created = await db.questionSkillTag.createMany({
        data: untagged.map((q) => ({
          questionId: q.id,
          skillId: result.skillId,
          weight: 1.0,
        })),
        skipDuplicates: true,
      });
      stats.questionTagsCreated += created.count;
    }
  }

  return stats;
}
