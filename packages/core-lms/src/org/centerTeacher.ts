/**
 * Cấp/thu hồi vai trò giảng viên trung tâm cho thành viên của một trường (CENTER, mục H).
 * Platform Admin hoặc quản trị trường của chính trường đó làm được; người nhận phải là thành viên của trường.
 * Vai trò này không cho quyền soạn nội dung: xem courses/teachingScope.ts.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { OrgMemberError } from "./members";

export async function setOrgMemberCenterTeacher(
  actorUserId: string,
  organizationId: string,
  targetUserId: string,
  enabled: boolean,
  db: PrismaClient = prisma,
): Promise<{ centerTeacher: boolean }> {
  // Phân quyền trước, để người ngoài không dò được trường hay thành viên nào tồn tại.
  if (!(await isAdmin(actorUserId, db)) && !(await isOrgAdminOf(actorUserId, organizationId, db))) {
    throw new OrgMemberError("forbidden");
  }
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new OrgMemberError("org_not_found");
  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { organizationId: true } });
  if (!target || target.organizationId !== organizationId) throw new OrgMemberError("not_member");

  const role = await db.role.upsert({
    where: { name: RoleName.CenterTeacher },
    update: {},
    create: { name: RoleName.CenterTeacher },
  });
  const existing = await db.userRole.findFirst({
    where: { userId: targetUserId, roleId: role.id, courseId: null },
    select: { id: true },
  });
  if (!!existing === enabled) return { centerTeacher: enabled };

  await db.$transaction(async (tx) => {
    if (enabled) {
      await tx.userRole.create({ data: { userId: targetUserId, roleId: role.id, grantedBy: actorUserId } });
    } else {
      await tx.userRole.delete({ where: { id: existing!.id } });
    }
    await logAudit(
      {
        action: "org.center_teacher_changed",
        actorUserId,
        payload: { organizationId, targetUserId, from: !enabled, to: enabled },
      },
      tx,
    );
  });
  return { centerTeacher: enabled };
}
