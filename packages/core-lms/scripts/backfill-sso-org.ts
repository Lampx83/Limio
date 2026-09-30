/**
 * Gắn trường mặc định (SSO_DEFAULT_ORG_CODE) cho user SSO đã có từ TRƯỚC khi
 * bật tính năng — loginOrLinkSso chỉ gắn lúc tạo/liên kết lần đầu nên không tự
 * quét lại người cũ. Chỉ đụng user: chưa thuộc trường nào, có liên kết
 * google/microsoft, email khớp SSO_DEFAULT_ORG_EMAIL_DOMAINS (nếu có đặt).
 * Idempotent, ghi audit từng người.
 *
 *   SSO_DEFAULT_ORG_CODE=HUST SSO_DEFAULT_ORG_EMAIL_DOMAINS=hust.edu.vn \
 *     pnpm backfill:sso-org -- --dry-run
 */
import { prisma } from "@feedbackme/db";
import { emailMatchesDomains, ssoDefaultOrgConfig } from "../src/auth/ssoDefaultOrg";
import { logAudit } from "../src/auth/audit";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const cfg = ssoDefaultOrgConfig();
  if (!cfg) throw new Error("Chưa đặt SSO_DEFAULT_ORG_CODE — không có trường nào để gắn.");
  const org = await prisma.organization.findUnique({
    where: { code: cfg.code },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`Không có Organization mã ${cfg.code}.`);

  const candidates = await prisma.user.findMany({
    where: {
      organizationId: null,
      authProviders: { some: { provider: { in: ["google", "microsoft"] } } },
    },
    select: { id: true, email: true },
  });
  const targets = candidates.filter((u) => emailMatchesDomains(u.email, cfg.domains));
  console.log(
    `${dryRun ? "[dry-run] " : ""}${targets.length}/${candidates.length} user SSO chưa có trường sẽ gắn vào ${org.name} (${cfg.code})`,
  );
  if (dryRun || targets.length === 0) return;

  for (const u of targets) {
    await prisma.user.update({ where: { id: u.id }, data: { organizationId: org.id } });
    await logAudit({
      action: "user.organization_changed",
      targetUserId: u.id,
      payload: { from: null, to: org.id, via: "backfill:sso-org" },
    });
  }
  console.log(`Đã gắn ${targets.length} user.`);
}

main().finally(() => prisma.$disconnect());
