/**
 * Cấp / thu quyền "Xem báo cáo" của một tổ chức (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC1).
 * Người cấp phải là OrgAdmin của tổ chức đó (hoặc Platform Admin). Mỗi lần cấp/thu ghi AuditLog
 * (CLAUDE.md §5.4: audit mọi đổi vai trò) và một LearningEvent `report.viewer.*`.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { emitEvent } from "../learning/events";

export class ReportViewerError extends Error {
  constructor(
    public readonly code: "forbidden" | "org_not_found" | "user_not_found" | "already_viewer" | "not_viewer",
  ) {
    super(code);
  }
}

export interface ReportViewerRow {
  userId: string;
  email: string;
  displayName: string;
  grantedAt: Date;
}

async function assertOrgAdmin(actorUserId: string, organizationId: string, db: PrismaClient) {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db))) throw new ReportViewerError("forbidden");
}

export async function listReportViewers(
  actorUserId: string,
  organizationId: string,
  db: PrismaClient = prisma,
): Promise<ReportViewerRow[]> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  const rows = await db.organizationReportViewer.findMany({
    where: { organizationId },
    orderBy: { grantedAt: "asc" },
    select: { userId: true, grantedAt: true, user: { select: { email: true, displayName: true } } },
  });
  return rows.map((r) => ({
    userId: r.userId,
    email: r.user.email,
    displayName: r.user.displayName,
    grantedAt: r.grantedAt,
  }));
}

export async function grantReportViewer(
  actorUserId: string,
  organizationId: string,
  targetEmail: string,
  db: PrismaClient = prisma,
): Promise<{ userId: string }> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new ReportViewerError("org_not_found");

  const email = targetEmail.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new ReportViewerError("user_not_found");

  const existing = await db.organizationReportViewer.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  if (existing) throw new ReportViewerError("already_viewer");

  await db.organizationReportViewer.create({
    data: { organizationId, userId: user.id, grantedByUserId: actorUserId },
  });
  await logAudit(
    { action: "report_viewer.granted", actorUserId, targetUserId: user.id, payload: { organizationId } },
    db,
  );
  await emitEvent(
    actorUserId,
    LearningEventType.ReportViewerGranted,
    { organizationId, targetUserId: user.id },
    { eventKey: `report.viewer.granted:${organizationId}:${user.id}:${Date.now()}` },
    db,
  );
  return { userId: user.id };
}

export async function revokeReportViewer(
  actorUserId: string,
  organizationId: string,
  targetUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  const existing = await db.organizationReportViewer.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  if (!existing) throw new ReportViewerError("not_viewer");

  await db.organizationReportViewer.delete({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  await logAudit(
    { action: "report_viewer.revoked", actorUserId, targetUserId, payload: { organizationId } },
    db,
  );
  await emitEvent(
    actorUserId,
    LearningEventType.ReportViewerRevoked,
    { organizationId, targetUserId },
    { eventKey: `report.viewer.revoked:${organizationId}:${targetUserId}:${Date.now()}` },
    db,
  );
}
