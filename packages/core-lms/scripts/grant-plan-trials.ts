/**
 * Cấp dùng thử không giới hạn đến 01/03/2027 cho giảng viên và tổ chức hiện có
 * (docs/tieu-chi/goi-tai-khoan.md). Mặc định chỉ đếm (dry-run); ghi thật phải có --apply.
 * Chạy lại được: ai đã có thuê bao dùng thử thì bị bỏ qua. Cần PLANS_ENABLED=1.
 *
 *   PLANS_ENABLED=1 pnpm backfill:plan-trials                      # chỉ đếm
 *   PLANS_ENABLED=1 pnpm backfill:plan-trials -- --apply [--actor email]
 *
 * --actor: email của platform admin đứng tên việc cấp; bỏ trống thì dùng admin tạo sớm nhất.
 */
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { grantTrialSubscriptions, TRIAL_ENDS_AT_ISO } from "../src/plans";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const actorIdx = args.indexOf("--actor");
const actorEmail = actorIdx >= 0 ? args[actorIdx + 1] : undefined;

async function resolveActor(): Promise<string> {
  const adminRole = { userRoles: { some: { role: { name: RoleName.Admin } } } };
  if (actorEmail) {
    const u = await prisma.user.findFirst({
      where: { email: actorEmail.toLowerCase(), ...adminRole },
      select: { id: true },
    });
    if (!u) throw new Error(`Không thấy platform admin có email ${actorEmail}`);
    return u.id;
  }
  const u = await prisma.user.findFirst({ where: adminRole, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!u) throw new Error("Không có platform admin nào để đứng tên (dùng --actor <email>)");
  return u.id;
}

async function main() {
  const actorUserId = await resolveActor();
  const r = await grantTrialSubscriptions({ dryRun: !apply, actorUserId });
  const tag = apply ? "" : "[dry-run] ";
  console.log(`${tag}Dùng thử đến ${TRIAL_ENDS_AT_ISO}`);
  console.log(`${tag}Giảng viên ${apply ? "đã cấp" : "sẽ cấp"}: ${r.usersGranted}`);
  console.log(`${tag}Tổ chức ${apply ? "đã cấp" : "sẽ cấp"}: ${r.orgsGranted}`);
  console.log(`${tag}Bỏ qua (đã có gói dùng thử): ${r.skipped}`);
  console.log(`RoleFeatureOverride đang đặt trên khoá bán được (${r.sellableRoleOverrides.length}):`);
  for (const o of r.sellableRoleOverrides) console.log(`  ${o.roleName}  ${o.featureKey} = ${JSON.stringify(o.value)}`);
  if (!apply) console.log("Chưa ghi gì. Thêm --apply để cấp thật.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
