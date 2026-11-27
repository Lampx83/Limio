/**
 * Vào khu quản trị đơn vị (chốt 2026-11-27, phần 4): người quản trị CHỌN một tổ chức rồi mới vào; menu và trang theo tổ chức đó.
 *
 * - OrgAdmin chỉ chọn được tổ chức mình được gán.
 * - Platform Admin chọn được mọi tổ chức, và MỖI LẦN vào một tổ chức mình không được gán thì ghi `AuditLog` `org.admin_entered`
 *   (ai, tổ chức nào, lúc nào): Platform Admin xem được tên học viên của trung tâm, nên việc vào phải để lại dấu vết.
 *   Vào tổ chức mình được gán là việc bình thường, không ghi.
 * - Hàm này không giữ trạng thái: nơi gọi (cookie ở web) nhớ tổ chức đang chọn, và gọi `canEnterOrg` mỗi lượt để kiểm lại quyền.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isAdmin } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { OrgMemberError } from "./members";
import { isOrgKind, type OrgKind } from "./orgKind";

export interface EnterableOrg {
  id: string;
  name: string;
  code: string;
  kind: OrgKind;
  /** Người này được gán làm OrgAdmin của tổ chức (khác với vào bằng quyền Platform Admin, có ghi nhật ký). */
  assigned: boolean;
}

function toKind(k: string): OrgKind {
  return isOrgKind(k) ? k : "school";
}

/** Các tổ chức người này chọn vào được: Platform Admin thấy mọi tổ chức, người khác chỉ tổ chức được gán. Sắp theo tên. */
export async function listEnterableOrgs(userId: string, db: PrismaClient = prisma): Promise<EnterableOrg[]> {
  const [platform, rows] = await Promise.all([
    isAdmin(userId, db),
    db.organizationAdmin.findMany({ where: { userId }, select: { organizationId: true } }),
  ]);
  const assigned = new Set(rows.map((r) => r.organizationId));
  const orgs = await db.organization.findMany({
    where: platform ? {} : { id: { in: [...assigned] } },
    select: { id: true, name: true, code: true, kind: true },
    orderBy: { name: "asc" },
  });
  return orgs.map((o) => ({ id: o.id, name: o.name, code: o.code, kind: toKind(o.kind), assigned: assigned.has(o.id) }));
}

/** Người này vào được khu quản trị của tổ chức không (Platform Admin hoặc OrgAdmin được gán). Không ghi gì. */
export async function canEnterOrg(userId: string, organizationId: string, db: PrismaClient = prisma): Promise<boolean> {
  if (await db.organizationAdmin.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { userId: true } })) return true;
  if (!(await isAdmin(userId, db))) return false;
  return (await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) !== null;
}

/**
 * Chọn một tổ chức để vào khu quản trị. Platform Admin vào tổ chức mình không được gán thì ghi nhật ký mỗi lần gọi (kể cả chọn lại
 * cùng tổ chức sau khi đổi), vì mỗi lần chọn là một lần vào.
 */
export async function enterOrgAdminWorkspace(
  actorUserId: string,
  organizationId: string,
  db: PrismaClient = prisma,
): Promise<EnterableOrg> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, code: true, kind: true } });
  const own = await db.organizationAdmin.findUnique({ where: { organizationId_userId: { organizationId, userId: actorUserId } }, select: { userId: true } });
  const platform = own ? false : await isAdmin(actorUserId, db);
  // Người không có quyền nào luôn nhận `forbidden`, kể cả khi tổ chức không có: không để dò xem mã nào tồn tại.
  if (!own && !platform) throw new OrgMemberError("forbidden");
  if (!org) throw new OrgMemberError("org_not_found");
  if (platform) {
    await logAudit({ action: "org.admin_entered", actorUserId, payload: { organizationId, kind: org.kind } }, db);
  }
  return { id: org.id, name: org.name, code: org.code, kind: toKind(org.kind), assigned: own !== null };
}
