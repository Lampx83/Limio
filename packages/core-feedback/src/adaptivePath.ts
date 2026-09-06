import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { resolveFeedbackVariant } from "./variant";

/** Per spec §4.4: skip suggestion when ALL tagged skills are ≥ this threshold. */
export const SKIP_MASTERY_THRESHOLD = 0.85;
/** Number of consecutive failed attempts that triggers a remedial inject. */
export const REMEDIAL_FAIL_STREAK = 2;

export interface SkipSuggestion {
  shouldSkip: boolean;
  /** Per-skill breakdown so the UI can explain *why* (or why not). */
  masteries: Array<{
    skillId: string;
    skillCode: string;
    skillName: string;
    masteryProbability: number;
    /** True when this skill blocks the skip (no data or mastery < threshold). */
    blocking: boolean;
  }>;
  reason: string;
}

/**
 * AC-B4.1..4 — decide whether the learner can safely skip a lesson based on
 * mastery of every skill the lesson is tagged with.
 *
 * Cold start guard: if any tagged skill has no `LearnerSkillState` row yet,
 * we don't suggest skip (we don't have data to back it up).
 */
export async function shouldSkipLesson(
  userId: string,
  lessonId: string,
  db: PrismaClient = prisma,
): Promise<SkipSuggestion> {
  const tags = await db.contentSkillMapping.findMany({
    where: { contentType: "lesson", contentId: lessonId },
    include: { skill: { select: { id: true, code: true, name: true } } },
  });

  if (tags.length === 0) {
    return {
      shouldSkip: false,
      masteries: [],
      reason: "no_skill_tags",
    };
  }

  const skillIds = tags.map((t) => t.skillId);
  const states = await db.learnerSkillState.findMany({
    where: { userId, skillId: { in: skillIds } },
  });
  const stateBySkill = new Map(states.map((s) => [s.skillId, s]));

  const masteries = tags.map((t) => {
    const state = stateBySkill.get(t.skillId);
    const mastery = state?.masteryProbability ?? null;
    const blocking = mastery === null || mastery < SKIP_MASTERY_THRESHOLD;
    return {
      skillId: t.skillId,
      skillCode: t.skill.code,
      skillName: t.skill.name,
      masteryProbability: mastery ?? 0,
      blocking,
    };
  });

  const blocking = masteries.filter((m) => m.blocking);
  const shouldSkip = blocking.length === 0;
  const reason = shouldSkip
    ? `mastery >= ${SKIP_MASTERY_THRESHOLD} for all ${masteries.length} skill(s)`
    : `${blocking.length} skill(s) below ${SKIP_MASTERY_THRESHOLD}`;

  return { shouldSkip, masteries, reason };
}

export interface RemedialSuggestion {
  shouldShow: boolean;
  weakestSkill?: {
    skillId: string;
    skillCode: string;
    skillName: string;
    masteryProbability: number;
  };
  lesson?: {
    id: string;
    title: string;
    courseSlug: string;
  };
  reason?: string;
}

/**
 * AC-B4.7..10 — when the learner has failed the same quiz 2× in a row,
 * surface a remedial lesson tagged with their weakest skill from that quiz.
 *
 * "2 in a row" = the learner's last `REMEDIAL_FAIL_STREAK` SUBMITTED attempts
 * for `quizId` all have `passed=false`. We deliberately ignore in_progress
 * and abandoned attempts.
 */
export async function getRemedialSuggestion(
  userId: string,
  quizId: string,
  db: PrismaClient = prisma,
): Promise<RemedialSuggestion> {
  const recent = await db.quizAttempt.findMany({
    where: { userId, quizId, status: "submitted" },
    orderBy: { submittedAt: "desc" },
    take: REMEDIAL_FAIL_STREAK,
    select: { passed: true },
  });
  if (
    recent.length < REMEDIAL_FAIL_STREAK ||
    recent.some((a) => a.passed !== false)
  ) {
    return { shouldShow: false, reason: "no_fail_streak" };
  }

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: { courseId: true },
  });
  if (!quiz?.courseId) return { shouldShow: false, reason: "course_unknown" };
  const courseId = quiz.courseId;

  // All skills tagged on this quiz's questions.
  const tags = await db.questionSkillTag.findMany({
    where: { question: { quizId } },
    include: { skill: { select: { id: true, code: true, name: true } } },
  });
  const distinctSkillIds = Array.from(new Set(tags.map((t) => t.skillId)));
  if (distinctSkillIds.length === 0)
    return { shouldShow: false, reason: "quiz_skills_untagged" };

  // Pick weakest skill (lowest mastery, must have at least 1 attempt).
  const states = await db.learnerSkillState.findMany({
    where: { userId, skillId: { in: distinctSkillIds }, attempts: { gte: 1 } },
    orderBy: [{ masteryProbability: "asc" }, { skillId: "asc" }],
    include: { skill: { select: { id: true, code: true, name: true } } },
    take: 1,
  });
  if (states.length === 0)
    return { shouldShow: false, reason: "no_skill_data" };
  const weakest = states[0]!;

  // Lessons in same course tagged with weakest skill, excluding completed.
  const completed = await db.learningEvent.findMany({
    where: {
      userId,
      courseId,
      eventType: LearningEventType.LessonCompleted,
    },
    select: { payload: true },
  });
  const completedSet = new Set<string>(
    completed.flatMap((r) => {
      const p = r.payload as { lessonId?: string } | null;
      return p?.lessonId ? [p.lessonId] : [];
    }),
  );

  const mappings = await db.contentSkillMapping.findMany({
    where: {
      contentType: "lesson",
      skillId: weakest.skillId,
      lesson: { module: { courseId } },
    },
    orderBy: { coverageWeight: "desc" },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          module: { select: { course: { select: { slug: true } } } },
        },
      },
    },
  });
  const candidate = mappings.find(
    (m) => m.lesson && !completedSet.has(m.lesson.id),
  );
  if (!candidate?.lesson) {
    // No fresh lesson available — but still surface the weakness so the UI
    // can advise revisiting an already-completed one.
    return {
      shouldShow: true,
      weakestSkill: {
        skillId: weakest.skill.id,
        skillCode: weakest.skill.code,
        skillName: weakest.skill.name,
        masteryProbability: weakest.masteryProbability,
      },
      reason: "no_uncompleted_lesson_for_weakest_skill",
    };
  }

  return {
    shouldShow: true,
    weakestSkill: {
      skillId: weakest.skill.id,
      skillCode: weakest.skill.code,
      skillName: weakest.skill.name,
      masteryProbability: weakest.masteryProbability,
    },
    lesson: {
      id: candidate.lesson.id,
      title: candidate.lesson.title,
      courseSlug: candidate.lesson.module.course.slug,
    },
    reason: "fail_streak_2",
  };
}

export interface AdaptiveNextLesson {
  lessonId: string;
  lessonTitle: string;
  weakestSkillCode: string;
  weakestSkillName: string;
  masteryProbability: number;
}

/**
 * AC-B4.12..14 — pick the next lesson to recommend on a course landing page.
 * Strategy: weakest course skill (mastery < 0.85, attempts ≥ 1) → top
 * uncompleted lesson tagged with that skill.
 */
export async function getAdaptiveNextLesson(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<AdaptiveNextLesson | null> {
  // B10 — lớp đối chứng không được định tuyến theo skill yếu. Đây là kênh cá
  // nhân hoá thứ hai mà người học nhìn thấy (thẻ "Đề xuất" ở trang khoá); để
  // hở nó thì lớp đối chứng vẫn được dẫn đường và phép so sánh với lớp
  // cá nhân hoá không còn nói lên điều gì.
  const { variant } = await resolveFeedbackVariant(userId, courseId, db);
  if (variant === "minimal") return null;

  // All skill ids covered by this course (via lesson mappings or question tags).
  const [csm, qst] = await Promise.all([
    db.contentSkillMapping.findMany({
      where: { contentType: "lesson", lesson: { module: { courseId } } },
      select: { skillId: true },
    }),
    db.questionSkillTag.findMany({
      where: { question: { quiz: { courseId } } },
      select: { skillId: true },
    }),
  ]);
  const courseSkillIds = Array.from(
    new Set([...csm.map((r) => r.skillId), ...qst.map((r) => r.skillId)]),
  );
  if (courseSkillIds.length === 0) return null;

  const weakStates = await db.learnerSkillState.findMany({
    where: {
      userId,
      skillId: { in: courseSkillIds },
      attempts: { gte: 1 },
      masteryProbability: { lt: SKIP_MASTERY_THRESHOLD },
    },
    orderBy: [{ masteryProbability: "asc" }, { skillId: "asc" }],
    include: { skill: { select: { code: true, name: true } } },
    take: 1,
  });
  if (weakStates.length === 0) return null;
  const weakest = weakStates[0]!;

  const completed = await db.learningEvent.findMany({
    where: { userId, courseId, eventType: LearningEventType.LessonCompleted },
    select: { payload: true },
  });
  const completedSet = new Set<string>(
    completed.flatMap((r) => {
      const p = r.payload as { lessonId?: string } | null;
      return p?.lessonId ? [p.lessonId] : [];
    }),
  );

  const mappings = await db.contentSkillMapping.findMany({
    where: {
      contentType: "lesson",
      skillId: weakest.skillId,
      lesson: { module: { courseId } },
    },
    orderBy: { coverageWeight: "desc" },
    include: { lesson: { select: { id: true, title: true } } },
  });
  const lesson = mappings.find(
    (m) => m.lesson && !completedSet.has(m.lesson.id),
  )?.lesson;
  if (!lesson) return null;

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    weakestSkillCode: weakest.skill.code,
    weakestSkillName: weakest.skill.name,
    masteryProbability: weakest.masteryProbability,
  };
}

/** Helper for the UI to log when a learner acted on (or dismissed) a path suggestion. */
export async function recordPathSuggestion(
  input: {
    userId: string;
    courseId: string;
    suggestionType: "skip" | "remedial" | "next";
    targetLessonId?: string;
    sourceContextId?: string;
    reason?: string;
  },
  db: PrismaClient = prisma,
): Promise<void> {
  await db.learningEvent.create({
    data: {
      userId: input.userId,
      courseId: input.courseId,
      eventType: LearningEventType.AdaptivePathUpdated,
      payload: {
        suggestionType: input.suggestionType,
        targetLessonId: input.targetLessonId,
        sourceContextId: input.sourceContextId,
        reason: input.reason,
      } as Prisma.InputJsonValue,
    },
  });
}
