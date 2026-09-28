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

/** Ảnh chữ ký người đại diện trường — hiện cạnh chữ ký Limio trên chứng nhận. */
export async function updateOrganizationSignature(
  actorUserId: string,
  organizationId: string,
  signatureUrl: string | null,
  db: PrismaClient = prisma,
): Promise<{ signatureImageUrl: string | null }> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  return db.organization.update({
    where: { id: organizationId },
    data: { signatureImageUrl: signatureUrl },
    select: { signatureImageUrl: true },
  });
}

/** Tên + chức danh người ký, in dưới ảnh chữ ký — cả 2 đều optional, rỗng thì lưu null. */
export async function updateOrganizationSignatureMeta(
  actorUserId: string,
  organizationId: string,
  meta: { name: string | null; title: string | null },
  db: PrismaClient = prisma,
): Promise<{ signatureName: string | null; signatureTitle: string | null }> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  const name = meta.name?.trim() || null;
  const title = meta.title?.trim() || null;
  return db.organization.update({
    where: { id: organizationId },
    data: { signatureName: name, signatureTitle: title },
    select: { signatureName: true, signatureTitle: true },
  });
}

/**
 * Tên trường — dùng trực tiếp trong issuerName ("Limio × <tên trường>") và
 * issuerOrgName snapshot lúc cấp chứng nhận (xem
 * packages/core-lms/src/certification/index.ts). Trước bản này, Organization
 * chỉ tạo được qua migration/SQL tay, chưa có đường sửa tên nào cho OrgAdmin.
 */
export async function updateOrganizationName(
  actorUserId: string,
  organizationId: string,
  name: string,
  db: PrismaClient = prisma,
): Promise<{ name: string }> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) {
    throw new ExamError("validation_failed");
  }
  return db.organization.update({
    where: { id: organizationId },
    data: { name: trimmed },
    select: { name: true },
  });
}
