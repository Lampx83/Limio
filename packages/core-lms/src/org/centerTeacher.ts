/**
 * Cấp/thu hồi vai trò giảng viên trung tâm cho thành viên của một trường (CENTER, mục H).
 * Chỉ cấp được trong tổ chức loại trung tâm. Platform Admin hoặc quản trị của chính tổ chức đó làm được; người nhận phải là thành viên của trường.
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
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true, kind: true } });
  if (!org) throw new OrgMemberError("org_not_found");
  // Vai này chỉ có nghĩa trong trung tâm: trường thường và nhà xuất bản không cấp được (thu hồi vai cũ thì vẫn được).
  if (enabled && org.kind !== "center") throw new OrgMemberError("validation_failed");
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
