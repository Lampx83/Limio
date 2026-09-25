/**
 * Gán role `learner` cho mọi user hiện chưa có role nào (chủ yếu tài khoản tạo
 * qua Google SSO trước khi loginOrLinkSso tự gán). Idempotent; không đụng user
 * đã có bất kỳ role nào.
 *
 *   pnpm backfill:learner-role
 *   pnpm backfill:learner-role -- --dry-run
 */

import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const learnerRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Learner } });
  const users = await prisma.user.findMany({
    where: { userRoles: { none: {} } },
    select: { id: true },
  });
  console.log(`${dryRun ? "[dry-run] " : ""}${users.length} user chưa có role nào`);
  if (dryRun || users.length === 0) return;
  const res = await prisma.userRole.createMany({
    data: users.map((u) => ({ userId: u.id, roleId: learnerRole.id })),
    skipDuplicates: true,
  });
  console.log(`Đã gán learner cho ${res.count} user`);
}

main().finally(() => prisma.$disconnect());
