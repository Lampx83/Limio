import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { BKT, updateMasteryBkt } from "./bkt";

/**
 * Walk every AnswerResponse in an attempt, look up each question's tagged
 * skills, and run a BKT update for each (skill × answer) pair. Idempotent
 * "enough" — calling twice on the same attempt double-applies. Spec §4.1
 * acceptance "*update trong < 5s sau quiz attempt*", so this is invoked once
 * from the submit route.
 */
/** Threshold at which a learner is considered to "master" a skill (spec §6.4 D4). */
export const MASTERY_THRESHOLD = 0.9;

export interface NewlyMasteredSkill {
  skillId: string;
  skillCode: string;
  skillName: string;
  masteryProbability: number;
}

export async function updateLearnerStateFromAttempt(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{
  skillsUpdated: number;
  answersProcessed: number;
  newlyMastered: NewlyMasteredSkill[];
}> {
  const responses = await db.answerResponse.findMany({
    where: { attemptId },
    select: {
      isCorrect: true,
      question: {
        select: {
          id: true,
          skillTags: { select: { skillId: true } },
        },
      },
    },
  });

  // Group answers by skill, preserving order, so we feed them sequentially
  // through BKT (Phase 2 simple — could vectorize later).
  const perSkill = new Map<string, boolean[]>();
  for (const r of responses) {
    for (const tag of r.question.skillTags) {
      if (!perSkill.has(tag.skillId)) perSkill.set(tag.skillId, []);
      perSkill.get(tag.skillId)!.push(r.isCorrect);
    }
  }

  let skillsUpdated = 0;
  const newlyMastered: NewlyMasteredSkill[] = [];

  for (const [skillId, observations] of perSkill) {
    const existing = await db.learnerSkillState.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });
    const priorMastery = existing?.masteryProbability ?? BKT.P_L0;
    let mastery = priorMastery;
    let attempts = existing?.attempts ?? 0;
    let correctCount = existing?.correctCount ?? 0;

    for (const isCorrect of observations) {
      const next = updateMasteryBkt(mastery, isCorrect);
      mastery = next.newMastery;
      attempts += 1;
      if (isCorrect) correctCount += 1;
    }

    await db.learnerSkillState.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: {
        userId,
        skillId,
        masteryProbability: mastery,
        attempts,
        correctCount,
      },
      update: {
        masteryProbability: mastery,
        attempts,
        correctCount,
      },
    });

    await db.learningEvent.create({
      data: {
        userId,
        eventType: LearningEventType.SkillStateUpdated,
        payload: {
          skillId,
          masteryProbability: mastery,
          attempts,
          correctCount,
          attemptId,
        } as Prisma.InputJsonValue,
      },
    });

    skillsUpdated += 1;

    // D4 — detect a newly-crossed mastery threshold for this skill.
    if (priorMastery < MASTERY_THRESHOLD && mastery >= MASTERY_THRESHOLD) {
      const skill = await db.skill.findUniqueOrThrow({
        where: { id: skillId },
        select: { id: true, code: true, name: true },
      });
      newlyMastered.push({
        skillId: skill.id,
        skillCode: skill.code,
        skillName: skill.name,
        masteryProbability: mastery,
      });
    }
  }

  return {
    skillsUpdated,
    answersProcessed: responses.length,
    newlyMastered,
  };
}

/**
 * Apply a single BKT observation to every skill tagged on a lesson. Used by
 * H5P xAPI bridge (and future external content) — when a learner completes
 * an interactive content item, treat the success/fail as one observation
 * spread across the lesson's tagged skills.
 *
 * Skill tags are resolved via `ContentSkillMapping.contentType="lesson"`.
 * Idempotent only at the call site — caller should debounce frequent xAPI
 * commits.
 */
export async function updateLearnerStateForLessonObservation(
  userId: string,
  lessonId: string,
  isCorrect: boolean,
  db: PrismaClient = prisma,
): Promise<{
  skillsUpdated: number;
  newlyMastered: NewlyMasteredSkill[];
}> {
  const tags = await db.contentSkillMapping.findMany({
    where: { contentType: "lesson", contentId: lessonId },
    select: { skillId: true },
  });
  const newlyMastered: NewlyMasteredSkill[] = [];
  let skillsUpdated = 0;

  for (const t of tags) {
    const existing = await db.learnerSkillState.findUnique({
      where: { userId_skillId: { userId, skillId: t.skillId } },
    });
    const priorMastery = existing?.masteryProbability ?? BKT.P_L0;
    const next = updateMasteryBkt(priorMastery, isCorrect);
    const mastery = next.newMastery;
    const attempts = (existing?.attempts ?? 0) + 1;
    const correctCount = (existing?.correctCount ?? 0) + (isCorrect ? 1 : 0);

    await db.learnerSkillState.upsert({
      where: { userId_skillId: { userId, skillId: t.skillId } },
      create: {
        userId,
        skillId: t.skillId,
        masteryProbability: mastery,
        attempts,
        correctCount,
      },
      update: { masteryProbability: mastery, attempts, correctCount },
    });
    await db.learningEvent.create({
      data: {
        userId,
        eventType: LearningEventType.SkillStateUpdated,
        payload: {
          skillId: t.skillId,
          masteryProbability: mastery,
          attempts,
          correctCount,
          source: "h5p",
          lessonId,
        } as Prisma.InputJsonValue,
      },
    });
    skillsUpdated += 1;

    if (priorMastery < MASTERY_THRESHOLD && mastery >= MASTERY_THRESHOLD) {
      const skill = await db.skill.findUniqueOrThrow({
        where: { id: t.skillId },
        select: { id: true, code: true, name: true },
      });
      newlyMastered.push({
        skillId: skill.id,
        skillCode: skill.code,
        skillName: skill.name,
        masteryProbability: mastery,
      });
    }
  }
  return { skillsUpdated, newlyMastered };
}

/**
 * Compute the average mastery probability for a learner across the distinct
 * skills tagged on a quiz. Used by D3 (adaptive reward sizing).
 *
 * Returns null when there are no skill states yet for those skills (cold
 * start) so callers can apply a multiplier of 1.0 instead of penalizing
 * a brand-new learner.
 */
export async function getAverageMasteryForQuiz(
  userId: string,
  quizId: string,
  db: PrismaClient = prisma,
): Promise<number | null> {
  const skillTags = await db.questionSkillTag.findMany({
    where: { question: { quizId } },
    select: { skillId: true },
  });
  const distinctSkillIds = Array.from(new Set(skillTags.map((t) => t.skillId)));
  if (distinctSkillIds.length === 0) return null;

  const states = await db.learnerSkillState.findMany({
    where: { userId, skillId: { in: distinctSkillIds } },
    select: { masteryProbability: true },
  });
  if (states.length === 0) return null;

  const sum = states.reduce((acc, s) => acc + s.masteryProbability, 0);
  return sum / states.length;
}

export interface SkillStateView {
  skillId: string;
  skillCode: string;
  skillName: string;
  masteryProbability: number;
  attempts: number;
  correctCount: number;
  /** True if mastery < 0.5 AND attempts ≥ 2 (per AC). */
  isWeak: boolean;
}

/**
 * Returns all (or course-filtered) skill states for a user. When `courseId` is
 * provided, only returns skills tagged on lessons / questions within that course.
 */
export async function getLearnerSkillStates(
  userId: string,
  courseId: string | undefined,
  db: PrismaClient = prisma,
): Promise<SkillStateView[]> {
  let skillIdsInCourse: Set<string> | null = null;
  if (courseId) {
    // Skills tagged via ContentSkillMapping (lessons in this course) OR
    // QuestionSkillTag (questions in any quiz in this course).
    const [csm, qst] = await Promise.all([
      db.contentSkillMapping.findMany({
        where: {
          contentType: "lesson",
          lesson: { module: { courseId } },
        },
        select: { skillId: true },
      }),
      db.questionSkillTag.findMany({
        where: { question: { quiz: { courseId } } },
        select: { skillId: true },
      }),
    ]);
    skillIdsInCourse = new Set([
      ...csm.map((r) => r.skillId),
      ...qst.map((r) => r.skillId),
    ]);
  }

  const states = await db.learnerSkillState.findMany({
    where: {
      userId,
      ...(skillIdsInCourse ? { skillId: { in: [...skillIdsInCourse] } } : {}),
    },
    include: { skill: { select: { code: true, name: true } } },
    orderBy: { masteryProbability: "asc" },
  });

  return states.map((s) => ({
    skillId: s.skillId,
    skillCode: s.skill.code,
    skillName: s.skill.name,
    masteryProbability: s.masteryProbability,
    attempts: s.attempts,
    correctCount: s.correctCount,
    isWeak: s.masteryProbability < 0.5 && s.attempts >= 2,
  }));
}
