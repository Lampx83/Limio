/**
 * Seed danh mục gói tài khoản. Idempotent: gói và giá chỉ tạo khi chưa có
 * (`update: {}`), không bao giờ ghi đè chỉnh sửa của admin.
 */
import { PLAN_CATALOG } from "@feedbackme/shared-types";
import { PrismaClient } from "./generated/client";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  for (const p of PLAN_CATALOG) {
    const before = await prisma.plan.findUnique({ where: { key: p.key }, select: { id: true } });
    const plan = await prisma.plan.upsert({
      where: { key: p.key },
      update: {},
      create: {
        key: p.key,
        name: p.name,
        scope: p.scope,
        entitlements: p.entitlements,
        referencePlanKey: p.referencePlanKey ?? null,
        isPublic: p.isPublic,
        sortOrder: p.sortOrder,
        active: true,
      },
    });
    if (!before) created++;
    for (const pr of p.prices ?? []) {
      await prisma.planPrice.upsert({
        where: { planId_period: { planId: plan.id, period: pr.period } },
        update: {},
        create: { planId: plan.id, period: pr.period, amountVnd: pr.amountVnd, active: true },
      });
    }
  }
  console.log(`Seeded plans: created ${created} of ${PLAN_CATALOG.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
