/** Seed Phase 1 daily quests. Idempotent. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const QUESTS = [
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
];

async function main() {
  for (const q of QUESTS) {
    await prisma.quest.upsert({
      where: { code: q.code },
      update: {
        name: q.name,
        description: q.description,
        emoji: q.emoji,
        target: q.target,
        rewardXp: q.rewardXp,
      },
      create: { ...q, kind: "daily" },
    });
  }
  console.log(`Seeded ${QUESTS.length} daily quests.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
