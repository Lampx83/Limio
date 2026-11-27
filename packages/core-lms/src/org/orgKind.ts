/**
 * Loại tổ chức (chốt 2026-11-27): mỗi tổ chức đúng MỘT loại.
 *   - `school`: trường thường (thành viên, thi cử, kỳ học, lớp và giáo viên).
 *   - `center`: trung tâm (thêm lịch lớp, điểm danh, điều phối; admin thấy tên học viên để liên hệ).
 *   - `publisher`: nhà xuất bản (học liệu, mã kích hoạt, báo cáo gộp; admin KHÔNG bao giờ thấy danh tính học viên).
 * Chỉ Platform Admin đổi loại: đổi loại là đổi cả phạm vi dữ liệu học viên mà admin của tổ chức được thấy, nên không để tự đổi.
 * `Organization.centerEnabled` là bản sao của `kind = center` (để các nơi đọc cũ chạy); chỉ hàm này được ghi nó.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isAdmin } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { OrgMemberError } from "./members";

export const ORG_KINDS = ["school", "center", "publisher"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_KIND_LABEL: Record<OrgKind, string> = {
  school: "Trường thường",
  center: "Trung tâm",
  publisher: "Nhà xuất bản",
};

export function isOrgKind(v: unknown): v is OrgKind {
  return typeof v === "string" && (ORG_KINDS as readonly string[]).includes(v);
}

/** Đổi loại tổ chức. Chỉ Platform Admin; ghi nhật ký `org.kind_changed` (cũ → mới); đặt lại đúng loại cũ thì không ghi gì. */
export async function setOrganizationKind(
  actorUserId: string,
  organizationId: string,
  kind: OrgKind,
  db: PrismaClient = prisma,
): Promise<{ kind: OrgKind }> {
  // Phân quyền trước, để người ngoài không dò được tổ chức nào tồn tại.
  if (!(await isAdmin(actorUserId, db))) throw new OrgMemberError("forbidden");
  if (!isOrgKind(kind)) throw new OrgMemberError("validation_failed");
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { kind: true } });
  if (!org) throw new OrgMemberError("org_not_found");
  if (org.kind === kind) return { kind };

  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: organizationId }, data: { kind, centerEnabled: kind === "center" } });
    await logAudit({ action: "org.kind_changed", actorUserId, payload: { organizationId, from: org.kind, to: kind } }, tx);
  });
  return { kind };
}
