/**
 * Seed Phase 1 milestone badges. Idempotent.
 */
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

const MILESTONES = [
  { code: "first_step", name: "First Step", emoji: "🎯", description: "Hoàn thành bài học đầu tiên trên FeedBackMe." },
  { code: "quiz_starter", name: "Quiz Starter", emoji: "✍️", description: "Bắt đầu bài kiểm tra đầu tiên." },
  { code: "first_win", name: "First Win", emoji: "✅", description: "Vượt qua bài kiểm tra đầu tiên." },
  { code: "perfect_score", name: "Perfect Score", emoji: "💯", description: "Đạt 100% trong một bài kiểm tra." },
  { code: "course_complete", name: "Course Complete", emoji: "🎓", description: "Hoàn thành toàn bộ một khóa học." },
  { code: "cleared_5", name: "Self-Corrector", emoji: "🪄", description: "Khắc phục 5 lỗi tư duy (misconception) qua việc trả lời đúng sau khi sai." },
  { code: "cleared_25", name: "Misconception Slayer", emoji: "🛡️", description: "Khắc phục 25 lỗi tư duy — bằng chứng bạn thực sự học từ sai lầm." },
];

async function main() {
  for (const b of MILESTONES) {
    await prisma.badge.upsert({
      where: { code: b.code },
      update: { name: b.name, emoji: b.emoji, description: b.description },
      create: { ...b, category: "milestone", rarity: "common" },
    });
  }
  console.log(`Seeded ${MILESTONES.length} milestone badges.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
