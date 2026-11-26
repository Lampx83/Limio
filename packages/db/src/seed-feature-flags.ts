/**
 * Seed D1 feature-permission catalog. Idempotent (upsert by key).
 * Xem CLAUDE.md / phương án phân quyền theo tính năng cho ý nghĩa từng key.
 */
import { PrismaClient } from "./generated/client";
import { FLAGS } from "./feature-flag-catalog";

const prisma = new PrismaClient();

async function main() {
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: {
        group: f.group,
        name: f.name,
        description: f.description,
        valueType: f.valueType,
        defaultValue: f.defaultValue,
        sellable: f.sellable,
      },
      create: f,
    });
  }
  console.log(`Seeded ${FLAGS.length} feature flags.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
