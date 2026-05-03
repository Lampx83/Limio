/**
 * Seed Phase 2 feedback templates. Idempotent.
 * One generic fallback + per-misconception templates for each Misconception
 * already seeded in the DB.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GENERIC_BODY =
  "Câu này bạn chưa đúng. Đọc lại phần lý thuyết tương ứng và xem các bài học gợi ý dưới đây để củng cố.";

const PER_MISCONCEPTION: Record<string, string> = {
  wrong_sign_when_moving_terms:
    "Có vẻ bạn đã quên đảo dấu khi chuyển một số hạng từ vế này sang vế kia. " +
    "Quy tắc: chuyển vế thì đổi dấu (+ thành -, và ngược lại). " +
    "Ví dụ: x + 5 = 12 → x = 12 - 5 = 7 (số 5 chuyển sang đổi thành -5).",
};

async function main() {
  // Generic fallback — upsert by a sentinel (one generic per "scope=generic").
  const existingGeneric = await prisma.feedbackTemplate.findFirst({
    where: { scope: "generic" },
  });
  if (!existingGeneric) {
    await prisma.feedbackTemplate.create({
      data: { scope: "generic", body: GENERIC_BODY, priority: 100 },
    });
    console.log("Created generic feedback template.");
  } else {
    await prisma.feedbackTemplate.update({
      where: { id: existingGeneric.id },
      data: { body: GENERIC_BODY },
    });
    console.log("Updated generic feedback template.");
  }

  for (const [code, body] of Object.entries(PER_MISCONCEPTION)) {
    const m = await prisma.misconception.findUnique({ where: { code } });
    if (!m) {
      console.log(`Skipping ${code} — misconception not found.`);
      continue;
    }
    const existing = await prisma.feedbackTemplate.findFirst({
      where: { scope: "per_misconception", misconceptionId: m.id },
    });
    if (!existing) {
      await prisma.feedbackTemplate.create({
        data: {
          scope: "per_misconception",
          misconceptionId: m.id,
          body,
          priority: 50,
        },
      });
      console.log(`Created template for ${code}.`);
    } else {
      await prisma.feedbackTemplate.update({
        where: { id: existing.id },
        data: { body },
      });
      console.log(`Updated template for ${code}.`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
