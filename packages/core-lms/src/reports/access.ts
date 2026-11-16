/**
 * Báo cáo cho nhà xuất bản — quyền xem (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC1).
 *
 * Ai xem được báo cáo của một khoá:
 *  - Platform Admin;
 *  - OrgAdmin hoặc người có quyền "Xem báo cáo" (OrganizationReportViewer) của tổ chức sở hữu khoá
 *    (`Course.organizationId`);
 *  - người SỬA được khoá (owner, co-instructor).
 *
 * Quyền "Xem báo cáo" chỉ được dùng ở đây. Nó KHÔNG được đi vào canEditCourse / canGradeCourse /
 * canModerateLiveExam hay "Khóa của tôi" — đó là điều kiện không hồi quy của AC1, có test.
 */
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { canEditCourse, EDIT_ROLES } from "../courses/authz";

/** True nếu user có quyền "Xem báo cáo" của tổ chức (kể cả OrgAdmin của tổ chức đó và Platform Admin). */
export async function isOrgReportViewerOf(
  userId: string,
  organizationId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  if (await isOrgAdminOf(userId, organizationId, db)) return true;
  const row = await db.organizationReportViewer.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  });
  return row !== null;
}

export async function canViewCourseReport(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  if (await isAdmin(userId, db)) return true;
  const course = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  if (!course) return false;
  if (course.organizationId && (await isOrgReportViewerOf(userId, course.organizationId, db))) return true;
  return canEditCourse(userId, courseId, db);
}

/** True nếu user có thể mở trang Báo cáo (có ít nhất một nguồn quyền). Dùng để hiện lối vào menu. */
export async function hasAnyReportAccess(userId: string, db: DbClient = prisma): Promise<boolean> {
  if (await isAdmin(userId, db)) return true;
  const [admin, viewer] = await Promise.all([
    db.organizationAdmin.count({ where: { userId } }),
    db.organizationReportViewer.count({ where: { userId } }),
  ]);
  if (admin + viewer > 0) return true;
  const sold = await db.course.count({ where: { ...soldCourseWhere(), instructors: { some: { userId, role: { in: [...EDIT_ROLES] } } } } });
  return sold > 0;
}

/** Khoá "có bán": có giá, có gói, có mã kích hoạt hoặc đã có đơn. Giảng viên chỉ thấy báo cáo của những khoá này. */
function soldCourseWhere() {
  return {
    OR: [
      { priceCents: { gt: 0 } },
      { accessPlans: { some: {} } },
      { accessCodes: { some: {} } },
      { orders: { some: {} } },
    ],
  };
}

export interface ReportCourseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  organizationId: string | null;
  organizationName: string | null;
}

/**
 * Các khoá user được xem báo cáo, khoá cập nhật gần nhất lên đầu.
 * Platform Admin: mọi khoá thuộc tổ chức hoặc có bán. OrgAdmin/người xem: khoá của tổ chức.
 * Giảng viên sửa được khoá: khoá có bán của mình.
 */
export async function listReportCourses(userId: string, db: DbClient = prisma): Promise<ReportCourseRow[]> {
  const select = {
    id: true,
    title: true,
    slug: true,
    status: true,
    organizationId: true,
    organization: { select: { name: true } },
  } as const;

  let where;
  if (await isAdmin(userId, db)) {
    where = { OR: [{ organizationId: { not: null } }, soldCourseWhere()] };
  } else {
    const [admins, viewers] = await Promise.all([
      db.organizationAdmin.findMany({ where: { userId }, select: { organizationId: true } }),
      db.organizationReportViewer.findMany({ where: { userId }, select: { organizationId: true } }),
    ]);
    const orgIds = Array.from(new Set([...admins, ...viewers].map((r) => r.organizationId)));
    where = {
      OR: [
        ...(orgIds.length ? [{ organizationId: { in: orgIds } }] : []),
        { AND: [soldCourseWhere(), { instructors: { some: { userId, role: { in: [...EDIT_ROLES] } } } }] },
      ],
    };
  }
  const rows = await db.course.findMany({ where, select, orderBy: { updatedAt: "desc" }, take: 300 });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    organizationId: r.organizationId,
    organizationName: r.organization?.name ?? null,
  }));
}
