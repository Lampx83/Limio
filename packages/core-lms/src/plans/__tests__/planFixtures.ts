/** Dữ liệu dựng chung cho test gói: cờ + danh mục gói + người dùng/tổ chức. */
import { prisma, Prisma } from "@feedbackme/db";
import { FLAGS } from "@feedbackme/db/feature-flag-catalog";
import { RoleName } from "@feedbackme/shared-types";
import { PLAN_CATALOG } from "../config";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";

let seq = 0;

export async function seedFlagsAndPlans() {
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, update: {}, create: f });
  }
  for (const p of PLAN_CATALOG) {
    await prisma.plan.create({
      data: {
        key: p.key,
        name: p.name,
        scope: p.scope,
        entitlements: p.entitlements as Prisma.InputJsonValue,
        referencePlanKey: p.referencePlanKey ?? null,
        isPublic: p.isPublic,
        sortOrder: p.sortOrder,
      },
    });
  }
}

export async function makeUser(tag: string) {
  seq += 1;
  const r = await registerUser(
    { email: `${tag}-${seq}-${Date.now()}@e.com`, password: "password1234", displayName: tag },
    "http://localhost:3000",
  );
  return r.userId;
}

export async function makeTeacher(tag = "gv") {
  const id = await makeUser(tag);
  await grantRole(id, { targetUserId: id, roleName: RoleName.Instructor });
  return id;
}

export async function makeOrg(tag: string) {
  seq += 1;
  return prisma.organization.create({ data: { code: `P${tag}-${seq}-${Date.now()}`, name: tag } });
}
