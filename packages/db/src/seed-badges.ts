/**
 * Seed Phase 1 milestone badges. Idempotent.
 */
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

const MILESTONES = [
  { code: "first_step", name: "Bước chân đầu tiên", emoji: "🎯", description: "Hoàn thành bài học đầu tiên." },
  { code: "quiz_starter", name: "Khởi động", emoji: "✍️", description: "Bắt đầu bài kiểm tra đầu tiên." },
  { code: "first_win", name: "Lần đầu vượt qua", emoji: "✅", description: "Vượt qua bài kiểm tra đầu tiên." },
  { code: "perfect_score", name: "Điểm tuyệt đối", emoji: "💯", description: "Đạt 100% trong một bài kiểm tra." },
  { code: "course_complete", name: "Về đích", emoji: "🎓", description: "Hoàn thành toàn bộ một khoá học." },
  { code: "cleared_5", name: "Tự sửa sai", emoji: "🪄", description: "Khắc phục 5 lỗi hiểu sai bằng cách trả lời đúng sau khi đã sai." },
  { code: "cleared_25", name: "Học từ sai lầm", emoji: "🛡️", description: "Khắc phục 25 lỗi hiểu sai — bằng chứng bạn thực sự học từ sai lầm." },
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
