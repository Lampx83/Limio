/**
 * Logo thương hiệu của Organization — hiển thị trên chứng nhận hoàn thành
 * khoá học do trường cấp ("Limio × <tên trường>", xem
 * packages/core-lms/src/certification/index.ts). Chỉ OrgAdmin của chính
 * trường đó (hoặc Platform Admin) được sửa.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isOrgAdminOf } from "../auth/roles";
import { ExamError } from "../exam/types";

async function assertOrgAdmin(
  actorUserId: string,
  organizationId: string,
  db: PrismaClient,
): Promise<void> {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db))) {
    throw new ExamError("forbidden");
  }
}

export async function updateOrganizationLogo(
  actorUserId: string,
  organizationId: string,
  logoUrl: string | null,
  db: PrismaClient = prisma,
): Promise<{ brandingLogoUrl: string | null }> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  return db.organization.update({
    where: { id: organizationId },
    data: { brandingLogoUrl: logoUrl },
    select: { brandingLogoUrl: true },
  });
}
