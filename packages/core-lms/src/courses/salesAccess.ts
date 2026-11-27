/**
 * Quyền "bán hàng" của khoá: mã kích hoạt và hoàn tiền (docs/tieu-chi/khu-nha-xuat-ban.md).
 *
 * Người được làm: (a) người SỬA được khoá (owner, co-instructor) hoặc Platform Admin, như trước; (b) quản trị (OrgAdmin) của tổ chức
 * LOẠI nhà xuất bản sở hữu khoá. Quản trị trường thường hay trung tâm KHÔNG được: họ không bán học liệu.
 *
 * Quyền này tách khỏi `canEditCourse`: quản trị nhà xuất bản bán và hoàn tiền được nhưng không sửa được nội dung khoá,
 * không vào được bảng điểm hay danh tính học viên (đó là điều kiện không hồi quy, có test).
 */
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin } from "../auth/roles";
import { canEditCourse, CourseAuthzError } from "./authz";

/** Quản trị của tổ chức loại nhà xuất bản sở hữu khoá (khoá không thuộc tổ chức nào, hay tổ chức loại khác, thì không). */
export async function isPublisherOrgAdminOfCourse(userId: string, courseId: string, db: DbClient = prisma): Promise<boolean> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { organization: { select: { id: true, kind: true } } },
  });
  const org = course?.organization;
  if (!org || org.kind !== "publisher") return false;
  const row = await db.organizationAdmin.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId } },
    select: { userId: true },
  });
  return row !== null;
}

export async function canManageCourseSales(userId: string, courseId: string, db: DbClient = prisma): Promise<boolean> {
  return (await canEditCourse(userId, courseId, db)) || (await isPublisherOrgAdminOfCourse(userId, courseId, db));
}

/** Ném CourseAuthzError nếu khoá không có hoặc người này không được quản lý bán hàng của khoá. */
export async function assertCanManageCourseSales(userId: string, courseId: string, db: DbClient = prisma): Promise<void> {
  if (await canManageCourseSales(userId, courseId, db)) return;
  const exists = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  throw new CourseAuthzError(exists ? "forbidden" : "not_found");
}

export interface PublisherOrgRow {
  id: string;
  name: string;
}

/**
 * Các tổ chức loại nhà xuất bản người này quản trị. Platform Admin thấy mọi nhà xuất bản (chọn tổ chức rồi mới vào, xem kế hoạch phần 4).
 */
export async function listPublisherOrgs(userId: string, db: DbClient = prisma): Promise<PublisherOrgRow[]> {
  if (await isAdmin(userId, db)) {
    return db.organization.findMany({ where: { kind: "publisher" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  }
  const rows = await db.organizationAdmin.findMany({
    where: { userId, organization: { kind: "publisher" } },
    select: { organization: { select: { id: true, name: true } } },
  });
  return rows.map((r) => r.organization).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function isPublisherOrgAdmin(userId: string, organizationId: string, db: DbClient = prisma): Promise<boolean> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { kind: true } });
  if (!org || org.kind !== "publisher") return false;
  if (await isAdmin(userId, db)) return true;
  const row = await db.organizationAdmin.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  });
  return row !== null;
}

export interface PublisherCourseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  enrollMode: string;
  /** Số mã kích hoạt còn chưa dùng (không gồm mã đã thu hồi). */
  unusedCodes: number;
  /** Số đơn đã trả tiền chưa hoàn. */
  paidOrders: number;
}

/** Các khoá của một nhà xuất bản kèm vài số cho trang mã kích hoạt và hoàn tiền. Người gọi phải là quản trị của tổ chức đó. */
export async function listPublisherCourses(userId: string, organizationId: string, db: DbClient = prisma): Promise<PublisherCourseRow[]> {
  if (!(await isPublisherOrgAdmin(userId, organizationId, db))) throw new CourseAuthzError("forbidden");
  const courses = await db.course.findMany({
    where: { organizationId },
    select: { id: true, title: true, slug: true, status: true, priceCents: true, currency: true, enrollMode: true },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  if (courses.length === 0) return [];
  const ids = courses.map((c) => c.id);
  const [codes, orders] = await Promise.all([
    db.courseAccessCode.groupBy({ by: ["courseId"], where: { courseId: { in: ids }, status: "unused" }, _count: { _all: true } }),
    db.order.groupBy({ by: ["courseId"], where: { courseId: { in: ids }, status: "paid" }, _count: { _all: true } }),
  ]);
  const codeBy = new Map(codes.map((c) => [c.courseId, c._count._all]));
  const orderBy = new Map(orders.map((o) => [o.courseId, o._count._all]));
  return courses.map((c) => ({ ...c, unusedCodes: codeBy.get(c.id) ?? 0, paidOrders: orderBy.get(c.id) ?? 0 }));
}
