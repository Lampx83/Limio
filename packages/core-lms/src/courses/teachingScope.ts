/**
 * Hai quyền trên một khoá, tách nhau (CENTER, mục H):
 *   - `manage`: được SOẠN và QUẢN — Platform Admin, chủ khoá, đồng giảng viên (hai vai trò được sửa nội dung).
 *     Đặt/sửa lịch, huỷ buổi, dạy bù, cập nhật giáo trình chỉ cho quyền này. Quản trị trường (OrgAdmin) của tổ chức sở hữu
 *     khoá cũng là `manage`: người điều hành trung tâm không dạy vẫn phải xếp lớp, đổi giáo viên, huỷ và dạy bù được.
 *     Quyền này KHÔNG mở nội dung bài giảng (`canEditCourse` không đổi).
 *   - `teach`: chỉ DẠY — người có tên trong khoá với vai trò khác (non-editing-teacher của giảng viên trung tâm,
 *     trợ giảng). Điểm danh, xem lịch/chuyên cần, nhận xét sau buổi chỉ cho buổi/lớp ĐƯỢC XẾP cho họ.
 * Trước đây các dịch vụ lịch và điểm danh kiểm bằng quyền "chấm bài" nên người chỉ được dạy cũng sửa được lịch.
 */
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { CourseAuthzError, EDIT_ROLES, canEditCourse, canGradeCourse } from "./authz";

export type TeachingScope = "manage" | "teach" | null;

export async function getTeachingScope(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<TeachingScope> {
  const [admin, ci] = await Promise.all([
    isAdmin(userId, db),
    db.courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId } }, select: { role: true } }),
  ]);
  if (admin) {
    const exists = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
    return exists ? "manage" : null;
  }
  if (ci && (EDIT_ROLES as readonly string[]).includes(ci.role)) return "manage";
  if (await isOrgAdminOfCourse(userId, courseId, db)) return "manage";
  if (!ci) return null;
  return "teach";
}

/** OrgAdmin của tổ chức sở hữu khoá (khoá không thuộc tổ chức nào thì không có OrgAdmin). */
export async function isOrgAdminOfCourse(userId: string, courseId: string, db: DbClient = prisma): Promise<boolean> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  if (!course?.organizationId) return false;
  const row = await db.organizationAdmin.findUnique({
    where: { organizationId_userId: { organizationId: course.organizationId, userId } },
    select: { userId: true },
  });
  return row !== null;
}

/**
 * Dựng và xếp lớp (tạo lớp, đổi giáo viên phụ trách, chuyển học viên giữa các lớp, nhập danh sách): mọi vai trò giảng viên như trước
 * (`canGradeCourse`) và thêm quản trị trường của tổ chức sở hữu khoá.
 */
export async function assertCanRunSections(userId: string, courseId: string, db: DbClient = prisma): Promise<void> {
  if (await canGradeCourse(userId, courseId, db)) return;
  if (await isOrgAdminOfCourse(userId, courseId, db)) return;
  await deny(courseId, db);
}

async function deny(courseId: string, db: DbClient): Promise<never> {
  const exists = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  throw new CourseAuthzError(exists ? "forbidden" : "not_found");
}

/** Chỉ người `manage` được qua; người khác (kể cả `teach`) bị từ chối. */
export async function assertCanManageCourse(userId: string, courseId: string, db: DbClient = prisma): Promise<void> {
  if ((await getTeachingScope(userId, courseId, db)) !== "manage") await deny(courseId, db);
}

/** Được xếp vào một buổi: giáo viên dự kiến của buổi, hoặc buổi chưa gán và mình là giáo viên phụ trách lớp. */
export function isAssignedToMeeting(
  userId: string,
  meeting: { plannedTeacherId: string | null; section: { instructorId: string | null } },
): boolean {
  if (meeting.plannedTeacherId) return meeting.plannedTeacherId === userId;
  return meeting.section.instructorId === userId;
}

/** Được xếp vào một lớp: giáo viên phụ trách lớp, hoặc dạy ít nhất một buổi / một khung giờ của lớp. */
export async function isAssignedToSection(
  userId: string,
  section: { id: string; instructorId: string | null },
  db: DbClient = prisma,
): Promise<boolean> {
  if (section.instructorId === userId) return true;
  const [meeting, slot] = await Promise.all([
    db.classMeeting.findFirst({ where: { sectionId: section.id, plannedTeacherId: userId }, select: { id: true } }),
    db.classScheduleSlot.findFirst({ where: { schedule: { sectionId: section.id }, plannedTeacherId: userId }, select: { id: true } }),
  ]);
  return meeting !== null || slot !== null;
}

/** Được thao tác dạy trên buổi này (điểm danh…): người `manage` luôn được; người `teach` chỉ khi được xếp. */
export async function assertCanTeachMeeting(
  userId: string,
  meeting: { plannedTeacherId: string | null; section: { courseId: string; instructorId: string | null } },
  db: DbClient = prisma,
): Promise<void> {
  const scope = await getTeachingScope(userId, meeting.section.courseId, db);
  if (scope === "manage") return;
  if (scope === "teach" && isAssignedToMeeting(userId, meeting)) return;
  await deny(meeting.section.courseId, db);
}

/** Được XEM lớp này (lịch, chuyên cần): người `manage` luôn được; người `teach` chỉ lớp được xếp. */
export async function assertCanViewSection(
  userId: string,
  section: { id: string; courseId: string; instructorId: string | null },
  db: DbClient = prisma,
): Promise<void> {
  const scope = await getTeachingScope(userId, section.courseId, db);
  if (scope === "manage") return;
  if (scope === "teach" && (await isAssignedToSection(userId, section, db))) return;
  await deny(section.courseId, db);
}

/** Người sửa được khoá, hoặc quản trị trường của khoá: dùng cho danh sách lớp/nhóm và giáo viên phụ trách (việc của người điều hành trung tâm). */
export async function canEditCourseOrOrgAdmin(userId: string, courseId: string, db: DbClient = prisma): Promise<boolean> {
  return (await canEditCourse(userId, courseId, db)) || (await isOrgAdminOfCourse(userId, courseId, db));
}

export async function assertCanEditCourseOrOrgAdmin(userId: string, courseId: string, db: DbClient = prisma): Promise<void> {
  if (!(await canEditCourseOrOrgAdmin(userId, courseId, db))) await deny(courseId, db);
}
