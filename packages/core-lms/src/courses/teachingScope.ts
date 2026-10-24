/**
 * Hai quyền trên một khoá, tách nhau (CENTER, mục H):
 *   - `manage`: được SOẠN và QUẢN — Platform Admin, chủ khoá, đồng giảng viên (hai vai trò được sửa nội dung).
 *     Đặt/sửa lịch, huỷ buổi, dạy bù, cập nhật giáo trình chỉ cho quyền này.
 *   - `teach`: chỉ DẠY — người có tên trong khoá với vai trò khác (non-editing-teacher của giảng viên trung tâm,
 *     trợ giảng). Điểm danh, xem lịch/chuyên cần, nhận xét sau buổi chỉ cho buổi/lớp ĐƯỢC XẾP cho họ.
 * Trước đây các dịch vụ lịch và điểm danh kiểm bằng quyền "chấm bài" nên người chỉ được dạy cũng sửa được lịch.
 */
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin } from "../auth/roles";
import { CourseAuthzError, EDIT_ROLES } from "./authz";

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
  if (!ci) return null;
  return (EDIT_ROLES as readonly string[]).includes(ci.role) ? "manage" : "teach";
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
