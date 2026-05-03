import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { awardXp } from "./xp";

/**
 * Default daily quest catalog. Idempotent upsert — call from a seed script
 * or during app boot. Codes are stable; handlers reference them via
 * `objective` (a one-quest-per-objective-per-period invariant).
 */
export const DAILY_QUESTS = [
  {
    code: "daily_one_lesson",
    name: "Học 1 bài",
    emoji: "📖",
    description: "Hoàn thành ít nhất 1 lesson hôm nay.",
    objective: "complete_lessons" as const,
    target: 1,
    rewardXp: 20,
  },
  {
    code: "daily_pass_quiz",
    name: "Vượt 1 quiz",
    emoji: "✅",
    description: "Vượt qua ít nhất 1 quiz hôm nay.",
    objective: "pass_quizzes" as const,
    target: 1,
    rewardXp: 30,
  },
  {
    code: "daily_resolve_misconception",
    name: "Khắc phục lỗi tư duy",
    emoji: "🪄",
    description: "Khắc phục ít nhất 1 misconception hôm nay.",
    objective: "resolve_misconceptions" as const,
    target: 1,
    rewardXp: 25,
  },
] as const;

export async function ensureDailyQuests(db: PrismaClient = prisma): Promise<void> {
  for (const q of DAILY_QUESTS) {
    await db.quest.upsert({
      where: { code: q.code },
      update: {
        name: q.name,
        description: q.description,
        emoji: q.emoji,
        target: q.target,
        rewardXp: q.rewardXp,
      },
      create: { ...q, kind: "daily" as const },
    });
  }
}

/** UTC yyyy-mm-dd key for "today". */
export function dailyPeriodKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ObjectiveCode =
  | "complete_lessons"
  | "pass_quizzes"
  | "resolve_misconceptions"
  | "earn_xp";

/**
 * Increment progress on every active quest matching this objective. Awards
 * `rewardXp` when target is reached (idempotent via UserQuestProgress.completed
 * flag). Pass `courseId` when the triggering action is course-scoped.
 */
export async function recordQuestProgress(
  userId: string,
  objective: ObjectiveCode,
  courseId: string | null,
  delta: number,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<{ completed: string[] }> {
  const periodKey = dailyPeriodKey(now);
  const quests = await db.quest.findMany({
    where: { active: true, kind: "daily", objective },
  });
  const completed: string[] = [];
  for (const q of quests) {
    const row = await db.userQuestProgress.upsert({
      where: { userId_questId_periodKey: { userId, questId: q.id, periodKey } },
      create: {
        userId,
        questId: q.id,
        periodKey,
        count: delta,
        courseId,
      },
      update: {
        count: { increment: delta },
        ...(courseId && { courseId }),
      },
    });
    if (!row.completed && row.count >= q.target) {
      // Target hit — flip flag + award XP.
      const updated = await db.userQuestProgress.update({
        where: { id: row.id },
        data: { completed: true, completedAt: now },
      });
      // XP per (user, quest, periodKey) — idempotent via sourceId.
      if (q.rewardXp > 0 && courseId) {
        await awardXp(
          {
            userId,
            courseId,
            amount: q.rewardXp,
            reason: "quest.completed",
            sourceId: `quest:${q.code}:${periodKey}`,
            extraEventPayload: { questCode: q.code, periodKey },
          },
          db,
        );
      }
      await db.learningEvent.create({
        data: {
          userId,
          courseId,
          eventType: LearningEventType.QuestCompleted,
          payload: {
            questId: q.id,
            questCode: q.code,
            periodKey,
            rewardXp: q.rewardXp,
            progressId: updated.id,
          } as Prisma.InputJsonValue,
          eventKey: `quest.completed:${userId}:${q.id}:${periodKey}`,
        },
      });
      completed.push(q.code);
    }
  }
  return { completed };
}

export interface QuestForUser {
  id: string;
  code: string;
  name: string;
  description: string;
  emoji: string | null;
  target: number;
  rewardXp: number;
  count: number;
  completed: boolean;
}

/** Today's daily quests for a user, with progress numbers filled in. */
export async function getDailyQuestsForUser(
  userId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<QuestForUser[]> {
  const periodKey = dailyPeriodKey(now);
  const quests = await db.quest.findMany({
    where: { active: true, kind: "daily" },
    orderBy: { code: "asc" },
  });
  const progress = await db.userQuestProgress.findMany({
    where: { userId, periodKey, questId: { in: quests.map((q) => q.id) } },
  });
  const byQuestId = new Map(progress.map((p) => [p.questId, p]));
  return quests.map((q) => ({
    id: q.id,
    code: q.code,
    name: q.name,
    description: q.description,
    emoji: q.emoji,
    target: q.target,
    rewardXp: q.rewardXp,
    count: byQuestId.get(q.id)?.count ?? 0,
    completed: byQuestId.get(q.id)?.completed ?? false,
  }));
}
