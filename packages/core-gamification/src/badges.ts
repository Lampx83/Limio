import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

/**
 * Phase 1 milestone badges. Codes are stable — handlers reference them.
 * Skill, social, hidden, and tournament badges arrive in Phase 2+.
 */
export const MILESTONE_BADGES = [
  {
    code: "first_step",
    name: "First Step",
    emoji: "🎯",
    description: "Hoàn thành bài học đầu tiên trên FeedBackMe.",
  },
  {
    code: "quiz_starter",
    name: "Quiz Starter",
    emoji: "✍️",
    description: "Bắt đầu bài kiểm tra đầu tiên.",
  },
  {
    code: "first_win",
    name: "First Win",
    emoji: "✅",
    description: "Vượt qua bài kiểm tra đầu tiên.",
  },
  {
    code: "perfect_score",
    name: "Perfect Score",
    emoji: "💯",
    description: "Đạt 100% trong một bài kiểm tra.",
  },
  {
    code: "course_complete",
    name: "Course Complete",
    emoji: "🎓",
    description: "Hoàn thành toàn bộ một khóa học.",
  },
  {
    code: "cleared_5",
    name: "Self-Corrector",
    emoji: "🪄",
    description: "Khắc phục 5 lỗi tư duy (misconception) qua việc trả lời đúng sau khi sai.",
  },
  {
    code: "cleared_25",
    name: "Misconception Slayer",
    emoji: "🛡️",
    description: "Khắc phục 25 lỗi tư duy — bằng chứng bạn thực sự học từ sai lầm.",
  },
] as const;

/** Tier thresholds for cleared-misconception badges. Order matters — we award
 *  every tier the user has crossed, starting from the highest unlocked. */
export const CLEARED_BADGE_TIERS: ReadonlyArray<{ code: MilestoneCode; threshold: number }> = [
  { code: "cleared_25", threshold: 25 },
  { code: "cleared_5", threshold: 5 },
];

export type MilestoneCode = (typeof MILESTONE_BADGES)[number]["code"];

/** Idempotent upsert — safe to run repeatedly (e.g. on every seed). */
export async function ensureMilestoneBadges(db: PrismaClient = prisma): Promise<void> {
  for (const b of MILESTONE_BADGES) {
    await db.badge.upsert({
      where: { code: b.code },
      update: { name: b.name, emoji: b.emoji, description: b.description },
      create: { ...b, category: "milestone", rarity: "common" },
    });
  }
}

export interface AwardBadgeResult {
  awarded: boolean;
  badgeCode: string;
}

/**
 * Award a badge by stable code. Idempotent via UserBadge unique constraint.
 * Emits `badge.earned` only on actual new awards. Generic over the code
 * string so D4 (skill_master:<skillCode>) can share the same path as
 * milestones.
 */
async function tryAwardBadge(
  userId: string,
  badgeCode: string,
  context: Record<string, unknown>,
  db: PrismaClient = prisma,
): Promise<AwardBadgeResult> {
  const badge = await db.badge.findUnique({
    where: { code: badgeCode },
    select: { id: true, code: true, name: true },
  });
  if (!badge) return { awarded: false, badgeCode };

  try {
    const userBadge = await db.userBadge.create({
      data: {
        userId,
        badgeId: badge.id,
        context: context as Prisma.InputJsonValue,
      },
    });
    await db.learningEvent.create({
      data: {
        userId,
        eventType: LearningEventType.BadgeEarned,
        payload: {
          badgeId: badge.id,
          badgeCode: badge.code,
          badgeName: badge.name,
          userBadgeId: userBadge.id,
          context,
        } as Prisma.InputJsonValue,
        // Idempotent emit even if the catch path triggers separately.
        eventKey: `badge.earned:${userId}:${badge.id}`,
        // We don't always know courseId, so pull from context if present.
        courseId: typeof context.courseId === "string" ? context.courseId : null,
      },
    });
    return { awarded: true, badgeCode };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return { awarded: false, badgeCode };
    throw e;
  }
}

// =====================================================================
// Event-specific badge checks. Each is called by the corresponding handler
// in apps/web orchestration after the underlying core-lms action lands.
// =====================================================================

export interface BadgeCheckResult {
  awarded: AwardBadgeResult[];
}

export async function checkLessonCompletedBadges(
  input: { userId: string; courseId: string; lessonId: string },
  db: PrismaClient = prisma,
): Promise<BadgeCheckResult> {
  const r = await tryAwardBadge(
    input.userId,
    "first_step",
    { courseId: input.courseId, lessonId: input.lessonId },
    db,
  );
  return { awarded: [r].filter((x) => x.awarded) };
}

export async function checkQuizStartedBadges(
  input: { userId: string; courseId: string; quizId: string; attemptId: string },
  db: PrismaClient = prisma,
): Promise<BadgeCheckResult> {
  const r = await tryAwardBadge(
    input.userId,
    "quiz_starter",
    { courseId: input.courseId, quizId: input.quizId, attemptId: input.attemptId },
    db,
  );
  return { awarded: [r].filter((x) => x.awarded) };
}

export async function checkQuizSubmittedBadges(
  input: {
    userId: string;
    courseId: string;
    quizId: string;
    attemptId: string;
    scorePct: number;
  },
  db: PrismaClient = prisma,
): Promise<BadgeCheckResult> {
  const awards: AwardBadgeResult[] = [];
  awards.push(
    await tryAwardBadge(
      input.userId,
      "first_win",
      { courseId: input.courseId, quizId: input.quizId, attemptId: input.attemptId },
      db,
    ),
  );
  if (input.scorePct >= 100) {
    awards.push(
      await tryAwardBadge(
        input.userId,
        "perfect_score",
        { courseId: input.courseId, quizId: input.quizId, attemptId: input.attemptId },
        db,
      ),
    );
  }
  return { awarded: awards.filter((a) => a.awarded) };
}

/**
 * D4 — Skill-based badges. Called by orchestration after core-feedback's
 * `updateLearnerStateFromAttempt` returns a list of `newlyMastered` skills.
 * Auto-creates the Badge row for each skill on first award.
 */
export interface SkillMasterInput {
  userId: string;
  courseId?: string | null;
  skills: Array<{
    skillId: string;
    skillCode: string;
    skillName: string;
  }>;
}

export async function awardSkillMasterBadges(
  input: SkillMasterInput,
  db: PrismaClient = prisma,
): Promise<BadgeCheckResult> {
  const awards: AwardBadgeResult[] = [];
  for (const s of input.skills) {
    const code = `skill_master:${s.skillCode}`;
    // Auto-upsert the Badge row — first time we see this skill master earned.
    await db.badge.upsert({
      where: { code },
      update: {}, // don't overwrite name/description if customized later
      create: {
        code,
        name: `Skill Master: ${s.skillName}`,
        description: `Đạt mastery ≥ 90% cho skill "${s.skillName}".`,
        emoji: "🏆",
        category: "skill",
        rarity: "common",
      },
    });
    const r = await tryAwardBadge(
      input.userId,
      code,
      {
        skillId: s.skillId,
        skillCode: s.skillCode,
        skillName: s.skillName,
        courseId: input.courseId ?? null,
      },
      db,
    );
    if (r.awarded) awards.push(r);
  }
  return { awarded: awards };
}

/**
 * Tier badges keyed off the cumulative count of misconception flags this user
 * has resolved. Called after `onMisconceptionResolved`. Awards every tier the
 * count has crossed (re-runs are no-ops via UserBadge unique).
 */
export async function checkClearedMisconceptionBadges(
  input: { userId: string; courseId: string },
  db: PrismaClient = prisma,
): Promise<BadgeCheckResult> {
  const resolvedCount = await db.misconceptionFlag.count({
    where: { userId: input.userId, resolved: true },
  });
  const awards: AwardBadgeResult[] = [];
  for (const tier of CLEARED_BADGE_TIERS) {
    if (resolvedCount >= tier.threshold) {
      const r = await tryAwardBadge(
        input.userId,
        tier.code,
        { courseId: input.courseId, resolvedCount, threshold: tier.threshold },
        db,
      );
      if (r.awarded) awards.push(r);
    }
  }
  return { awarded: awards };
}

export async function checkCourseCompletedBadges(
  input: { userId: string; courseId: string },
  db: PrismaClient = prisma,
): Promise<BadgeCheckResult> {
  const r = await tryAwardBadge(
    input.userId,
    "course_complete",
    { courseId: input.courseId },
    db,
  );
  return { awarded: [r].filter((x) => x.awarded) };
}

// =====================================================================
// Read-side helpers
// =====================================================================

export async function listBadgeCatalog(db: PrismaClient = prisma) {
  return db.badge.findMany({
    where: { category: "milestone" },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      emoji: true,
      category: true,
      rarity: true,
    },
  });
}

export async function listUserBadges(userId: string, db: PrismaClient = prisma) {
  return db.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    include: {
      badge: {
        select: {
          code: true,
          name: true,
          description: true,
          emoji: true,
          category: true,
        },
      },
    },
  });
}
