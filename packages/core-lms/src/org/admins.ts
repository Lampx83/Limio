/**
 * Cấp/thu hồi quyền OrgAdmin cho user — chỉ Platform Admin được làm việc
 * này (khác các file khác trong module `org/` như branding.ts, vốn cho
 * chính OrgAdmin tự sửa org của mình). "Quyền" ở đây không phải cột/enum
 * mà là sự tồn tại của 1 row trong `OrganizationAdmin` — xem isOrgAdminOf
 * trong ../auth/roles.ts.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isAdmin } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { emitEvent } from "../learning/events";

export class OrgAdminError extends Error {
  constructor(
    public readonly code:
      | "forbidden"
      | "org_not_found"
      | "user_not_found"
      | "already_admin"
      | "not_admin",
  ) {
    super(code);
  }
}

async function assertPlatformAdmin(
  actorUserId: string,
  db: PrismaClient,
): Promise<void> {
  if (!(await isAdmin(actorUserId, db))) throw new OrgAdminError("forbidden");
}

export interface OrgAdminRow {
  userId: string;
  email: string;
  displayName: string;
  grantedAt: Date;
  grantedByUserId: string | null;
  grantedByName: string | null;
}

/** Danh sách user đang là OrgAdmin của 1 org. Không tự check quyền — caller (API route) gate bằng requireAdmin. */
export async function listOrgAdmins(
  organizationId: string,
  db: PrismaClient = prisma,
): Promise<OrgAdminRow[]> {
  const rows = await db.organizationAdmin.findMany({
    where: { organizationId },
    orderBy: { grantedAt: "asc" },
  });

  // `grantedByUserId` không có Prisma relation (chỉ String?) nên tự join tay.
  const userIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.userId, r.grantedByUserId]).filter((id): id is string => !!id),
    ),
  );
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, displayName: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const u = byId.get(r.userId);
    const granter = r.grantedByUserId ? byId.get(r.grantedByUserId) : null;
    return {
      userId: r.userId,
      email: u?.email ?? "(đã xoá)",
      displayName: u?.displayName ?? "(đã xoá)",
      grantedAt: r.grantedAt,
      grantedByUserId: r.grantedByUserId,
      grantedByName: granter?.displayName ?? null,
    };
  });
}

/**
 * Cấp quyền OrgAdmin cho user tìm theo email. Idempotent theo nghĩa báo lỗi
 * `already_admin` rõ ràng thay vì tạo trùng (composite PK vốn đã chặn ở DB,
 * nhưng check trước để trả lỗi có ý nghĩa thay vì lỗi P2002 thô).
 */
export async function grantOrgAdmin(
  actorUserId: string,
  organizationId: string,
  targetEmail: string,
  db: PrismaClient = prisma,
): Promise<{ userId: string; created: boolean }> {
  await assertPlatformAdmin(actorUserId, db);

  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new OrgAdminError("org_not_found");

  const email = targetEmail.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new OrgAdminError("user_not_found");

  const existing = await db.organizationAdmin.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  if (existing) throw new OrgAdminError("already_admin");

  await db.organizationAdmin.create({
    data: { organizationId, userId: user.id, grantedByUserId: actorUserId },
  });

  await logAudit(
    {
      action: "org_admin.granted",
      actorUserId,
      targetUserId: user.id,
      payload: { organizationId },
    },
    db,
  );
  await emitEvent(
    actorUserId,
    LearningEventType.OrgAdminGranted,
    { organizationId, targetUserId: user.id },
    { eventKey: `org.admin.granted:${organizationId}:${user.id}` },
    db,
  );

  return { userId: user.id, created: true };
}

/** Thu hồi quyền OrgAdmin. */
export async function revokeOrgAdmin(
  actorUserId: string,
  organizationId: string,
  targetUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertPlatformAdmin(actorUserId, db);

  const existing = await db.organizationAdmin.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  if (!existing) throw new OrgAdminError("not_admin");

  await db.organizationAdmin.delete({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });

  await logAudit(
    {
      action: "org_admin.revoked",
      actorUserId,
      targetUserId,
      payload: { organizationId },
    },
    db,
  );
  await emitEvent(
    actorUserId,
    LearningEventType.OrgAdminRevoked,
    { organizationId, targetUserId },
    { eventKey: `org.admin.revoked:${organizationId}:${targetUserId}:${Date.now()}` },
    db,
  );
}
