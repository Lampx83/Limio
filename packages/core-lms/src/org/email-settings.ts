/**
 * Cấu hình gửi mail mời của một trường — 3 công tắc, Platform Admin hoặc
 * OrgAdmin của chính trường đó đổi được:
 *  - inviteEmailOnImport         import hàng loạt thành viên (mặc định TẮT)
 *  - inviteEmailOnInstructorAdd  thêm đồng giảng viên / GV lớp / GV đợt thi (mặc định BẬT)
 *  - inviteEmailOnProctorAdd     thêm giám thị phòng thi (mặc định BẬT)
 * "Mail mời" = mail đặt mật khẩu gửi cho tài khoản MỚI tạo; người đã có tài
 * khoản không bao giờ nhận mail này. Cổng kiểm tra: email/inviteGate.ts.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { OrgMemberError } from "./members";

export const ORG_EMAIL_SETTING_KEYS = [
  "inviteEmailOnImport",
  "inviteEmailOnInstructorAdd",
  "inviteEmailOnProctorAdd",
] as const;

export type OrgEmailSettingKey = (typeof ORG_EMAIL_SETTING_KEYS)[number];
export type OrgEmailSettings = Record<OrgEmailSettingKey, boolean>;

export async function updateOrgEmailSettings(
  actorUserId: string,
  organizationId: string,
  patch: Partial<OrgEmailSettings>,
  db: PrismaClient = prisma,
): Promise<OrgEmailSettings> {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db))) {
    throw new OrgMemberError("forbidden");
  }
  const before = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      inviteEmailOnImport: true,
      inviteEmailOnInstructorAdd: true,
      inviteEmailOnProctorAdd: true,
    },
  });
  if (!before) throw new OrgMemberError("org_not_found");

  const changes: Partial<OrgEmailSettings> = {};
  for (const key of ORG_EMAIL_SETTING_KEYS) {
    const next = patch[key];
    if (typeof next === "boolean" && next !== before[key]) changes[key] = next;
  }
  if (Object.keys(changes).length === 0) return before;

  const updated = await db.organization.update({
    where: { id: organizationId },
    data: changes,
    select: {
      inviteEmailOnImport: true,
      inviteEmailOnInstructorAdd: true,
      inviteEmailOnProctorAdd: true,
    },
  });
  for (const [key, to] of Object.entries(changes)) {
    await logAudit(
      {
        action: "org.email_setting_changed",
        actorUserId,
        payload: { organizationId, setting: key, from: before[key as OrgEmailSettingKey], to },
      },
      db,
    );
  }
  return updated;
}
