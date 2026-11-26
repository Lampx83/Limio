/**
 * Co-instructor management — owner attaches another instructor by email,
 * no invite/accept step. If the email doesn't have an account yet, one is
 * created for them (no password) and a "set your password" email is sent,
 * same pattern as `inviteUserAsProctor` (exam-rounds.ts). If the email
 * already has an account, they're granted access immediately — next login
 * they see the course.
 *
 * Authz: the course `owner`, an OrgAdmin of the course's organization, or a Platform Admin can add/remove
 * instructors (assertCanManageInstructors). Trung tâm có giáo viên ra vào liên tục nên người quản lý không dạy
 * cũng phải gỡ được quyền dạy.
 * Co-instructors get the same content-edit rights as owner via the existing
 * assertCanEditCourse (unchanged) — this module only guards instructor
 * management itself.
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { findOrInviteUserByEmail } from "../auth/invite";
import { emitEvent } from "../learning/events";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { CourseAuthzError, GRADE_ROLES, isCourseOwner } from "./authz";
import { CourseError } from "./courses";

/**
 * Chủ khoá, OrgAdmin của tổ chức sở hữu khoá, hoặc Platform Admin. Đồng giảng viên (sửa được nội dung) KHÔNG quản lý được
 * người khác: sửa nội dung và quản nhân sự là hai việc.
 */
export async function assertCanManageInstructors(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  if (!course) throw new CourseAuthzError("not_found");
  if (await isCourseOwner(userId, courseId, db)) return;
  if (course.organizationId ? await isOrgAdminOf(userId, course.organizationId, db) : await isAdmin(userId, db)) return;
  throw new CourseAuthzError("forbidden");
}

/** Roles assignable via addCoInstructorByEmail. `owner` is set only at course creation. */
export const ASSIGNABLE_ROLES = [
  "co-instructor",
  "non-editing-teacher",
  "teaching-assistant",
] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export interface CourseInstructorRow {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  addedAt: Date;
}

/** List owner + co-instructors of a course, owner first. */
export async function listCourseInstructors(
  courseId: string,
  db: PrismaClient = prisma,
): Promise<CourseInstructorRow[]> {
  const rows = await db.courseInstructor.findMany({
    where: { courseId },
    include: { user: { select: { email: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows
    .map((r) => ({
      userId: r.userId,
      email: r.user.email,
      displayName: r.user.displayName,
      role: r.role,
      addedAt: r.createdAt,
    }))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));
}

/**
 * Attach a co-instructor by email with the given role. Idempotent — adding
 * the same email twice just updates the role on the existing row (lets the
 * owner change someone's role by re-adding them with a different role).
 */
export async function addCoInstructorByEmail(
  actorUserId: string,
  courseId: string,
  rawEmail: string,
  role: string,
  baseUrl: string,
  db: PrismaClient = prisma,
): Promise<{ userId: string; invited: boolean }> {
  await assertCanManageInstructors(actorUserId, courseId, db);

  if (!ASSIGNABLE_ROLES.includes(role as AssignableRole)) {
    throw new CourseError("invalid_role");
  }

  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CourseError("invalid_email");
  }

  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { title: true, organizationId: true },
  });

  const { userId, invited } = await findOrInviteUserByEmail({
    email,
    displayName: "",
    baseUrl,
    templateKey: "course.co_instructor_invite",
    organizationId: course.organizationId,
    extraVariables: { courseTitle: course.title },
    db,
  });

  const existing = await db.courseInstructor.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { role: true },
  });
  if (existing?.role === "owner") {
    throw new CourseError("cannot_change_owner_role");
  }

  await db.courseInstructor.upsert({
    where: { courseId_userId: { courseId, userId } },
    update: { role },
    create: { courseId, userId, role },
  });

  await emitEvent(
    actorUserId,
    LearningEventType.CourseInstructorAdded,
    { courseId, addedUserId: userId, invited },
    { courseId, eventKey: `course.instructor.added:${courseId}:${userId}` },
    db,
  );

  return { userId, invited };
}

/** Việc đang giao cho một giáo viên trong khoá: để hộp xác nhận gỡ nói rõ gỡ sẽ làm gì. */
export interface InstructorAssignments {
  /** Lớp mà họ là giáo viên phụ trách. */
  sections: Array<{ id: string; name: string }>;
  /** Buổi CHƯA dạy (planned, từ bây giờ trở đi) xếp họ làm giáo viên dự kiến. */
  upcomingMeetings: number;
  /** Khung giờ lặp của lịch xếp họ làm giáo viên dự kiến. */
  slots: number;
}

export async function getInstructorAssignments(
  courseId: string,
  userId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<InstructorAssignments> {
  const [sections, upcomingMeetings, slots] = await Promise.all([
    db.courseSection.findMany({ where: { courseId, instructorId: userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.classMeeting.count({ where: { section: { courseId }, plannedTeacherId: userId, status: "planned", startsAt: { gte: now } } }),
    db.classScheduleSlot.count({ where: { schedule: { section: { courseId } }, plannedTeacherId: userId } }),
  ]);
  return { sections, upcomingMeetings, slots };
}

export interface RemoveInstructorOptions {
  /**
   * Chuyển các việc đang giao (lớp phụ trách, buổi sắp tới, khung giờ) cho giáo viên này; bỏ trống thì để trống chỗ người dạy.
   * Người nhận phải đang có tên trong khoá.
   */
  handoverToUserId?: string | null;
}

/**
 * Gỡ một người khỏi khoá, MỘT thao tác: xoá quyền, và dọn mọi việc đang giao (lớp phụ trách, buổi sắp tới, khung giờ lặp) để không còn buổi "mồ côi" ghi tên
 * người không còn quyền dạy. Buổi đã dạy/đã huỷ giữ nguyên (điểm danh, check-in, nhận xét là lịch sử). Quyền dạy có hiệu lực ngay vì mọi kiểm tra đọc bảng giảng viên mỗi
 * yêu cầu. Chủ khoá (owner) không gỡ được ở đây. Ghi event + AuditLog.
 */
export async function removeCoInstructor(
  actorUserId: string,
  courseId: string,
  targetUserId: string,
  opts: RemoveInstructorOptions = {},
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<{ handedOverTo: string | null; sections: number; meetings: number; slots: number }> {
  await assertCanManageInstructors(actorUserId, courseId, db);

  const row = await db.courseInstructor.findUnique({
    where: { courseId_userId: { courseId, userId: targetUserId } },
    select: { role: true },
  });
  if (!row) throw new CourseError("instructor_not_found");
  if (row.role === "owner") throw new CourseError("cannot_remove_owner");

  const handoverTo = opts.handoverToUserId ?? null;
  if (handoverTo) {
    if (handoverTo === targetUserId) throw new CourseError("handover_target_invalid");
    const to = await db.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId: handoverTo } },
      select: { role: true },
    });
    if (!to || !(GRADE_ROLES as readonly string[]).includes(to.role)) throw new CourseError("handover_target_invalid");
  }

  const result = await db.$transaction(async (tx) => {
    await tx.courseInstructor.delete({ where: { courseId_userId: { courseId, userId: targetUserId } } });
    const sections = await tx.courseSection.updateMany({
      where: { courseId, instructorId: targetUserId },
      data: { instructorId: handoverTo },
    });
    const meetings = await tx.classMeeting.updateMany({
      where: { section: { courseId }, plannedTeacherId: targetUserId, status: "planned", startsAt: { gte: now } },
      data: { plannedTeacherId: handoverTo },
    });
    const slots = await tx.classScheduleSlot.updateMany({
      where: { schedule: { section: { courseId } }, plannedTeacherId: targetUserId },
      data: { plannedTeacherId: handoverTo },
    });
    const counts = { sections: sections.count, meetings: meetings.count, slots: slots.count };
    // Payload chỉ id và số đếm (không mang tên, email hay lý do).
    await emitEvent(
      actorUserId,
      LearningEventType.CourseInstructorRemoved,
      { courseId, removedUserId: targetUserId, handedOverTo: handoverTo, ...counts },
      { courseId, eventKey: `course.instructor.removed:${courseId}:${targetUserId}:${now.getTime()}` },
      tx as unknown as PrismaClient,
    );
    await logAudit(
      { action: "course.instructor_removed", actorUserId, targetUserId, payload: { courseId, role: row.role, handedOverTo: handoverTo, ...counts } },
      tx as unknown as PrismaClient,
    );
    return counts;
  });
  return { handedOverTo: handoverTo, ...result };
}

/**
 * Phân giảng = xếp một giáo viên phụ trách lớp. Người đó phải dạy được trên khoá, nên nếu chưa có tên trong khoá thì thêm làm "GV không chỉnh sửa"
 * (chỉ dạy, không sửa nội dung). Chỉ áp cho khoá ngoại ngữ hoặc khoá của tổ chức bật tính năng trung tâm; khoá khác giữ hành vi cũ (xếp lớp không cấp quyền).
 * Trả về true nếu vừa thêm.
 */
export async function ensureTeachRoleForAssignment(
  actorUserId: string,
  courseId: string,
  userId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { languageMode: true, organization: { select: { centerEnabled: true } } },
  });
  if (!course || !(course.languageMode || course.organization?.centerEnabled)) return false;
  const existing = await db.courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId } }, select: { userId: true } });
  if (existing) return false;
  await db.courseInstructor.create({ data: { courseId, userId, role: "non-editing-teacher" } });
  await emitEvent(
    actorUserId,
    LearningEventType.CourseInstructorAdded,
    { courseId, addedUserId: userId, invited: false, via: "section_assignment" },
    { courseId, eventKey: `course.instructor.added:${courseId}:${userId}` },
    db,
  );
  return true;
}
