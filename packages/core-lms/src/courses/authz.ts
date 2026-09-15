import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin } from "../auth/roles";

/**
 * 4 CourseInstructor roles, from broadest to narrowest edit rights:
 *   owner                — full control, incl. manage instructors + delete course
 *   co-instructor        — same content-edit rights as owner
 *   non-editing-teacher  — can grade + moderate live exams, cannot edit content
 *   teaching-assistant   — can grade only; cannot moderate live exams or edit content
 */
export const EDIT_ROLES = ["owner", "co-instructor"] as const;
export const LIVE_MODERATE_ROLES = ["owner", "co-instructor", "non-editing-teacher"] as const;
export const GRADE_ROLES = [
  "owner",
  "co-instructor",
  "non-editing-teacher",
  "teaching-assistant",
] as const;

async function hasRoleIn(
  userId: string,
  courseId: string,
  allowedRoles: readonly string[],
  db: DbClient,
): Promise<boolean> {
  const [admin, ci] = await Promise.all([
    isAdmin(userId, db),
    db.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { role: true },
    }),
  ]);
  return admin || (ci !== null && allowedRoles.includes(ci.role));
}

/** True if userId can edit course content (lesson/quiz/exam structure), or is a platform admin. */
export async function canEditCourse(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  return hasRoleIn(userId, courseId, EDIT_ROLES, db);
}

/** True if userId can grade student work on this course, or is a platform admin. Broadest instructor-tier check — includes teaching-assistant. */
export async function canGradeCourse(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  return hasRoleIn(userId, courseId, GRADE_ROLES, db);
}

/** True if userId can intervene live during an exam (extend/force-submit/disqualify/message) or view analytics, or is a platform admin. Excludes teaching-assistant. */
export async function canModerateLiveExam(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  return hasRoleIn(userId, courseId, LIVE_MODERATE_ROLES, db);
}

export class CourseAuthzError extends Error {
  constructor(public readonly code: "forbidden" | "not_found") {
    super(code);
  }
}

async function assertCourseExists(courseId: string, db: DbClient): Promise<void> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) throw new CourseAuthzError("not_found");
}

/** Throws CourseAuthzError if the course doesn't exist or user can't edit it. */
export async function assertCanEditCourse(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<void> {
  await assertCourseExists(courseId, db);
  const ok = await canEditCourse(userId, courseId, db);
  if (!ok) throw new CourseAuthzError("forbidden");
}

/** Throws CourseAuthzError if the course doesn't exist or user can't grade on it. */
export async function assertCanGradeCourse(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<void> {
  await assertCourseExists(courseId, db);
  const ok = await canGradeCourse(userId, courseId, db);
  if (!ok) throw new CourseAuthzError("forbidden");
}

/** Throws CourseAuthzError if the course doesn't exist or user can't moderate live exams on it. */
export async function assertCanModerateLiveExam(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<void> {
  await assertCourseExists(courseId, db);
  const ok = await canModerateLiveExam(userId, courseId, db);
  if (!ok) throw new CourseAuthzError("forbidden");
}

/**
 * Đề không gắn khoá học (courseId = null) không có bảng CourseInstructor để
 * tra role — chỉ người tạo đề (createdById) hoặc admin được sửa/chấm/can
 * thiệp. Đề có khoá học vẫn đi qua đúng logic role theo course như cũ.
 */
async function ownerOrCourseRole(
  userId: string,
  exam: { courseId: string | null; createdById: string | null },
  courseCheck: (userId: string, courseId: string, db: DbClient) => Promise<boolean>,
  db: DbClient,
): Promise<boolean> {
  if (exam.courseId) return courseCheck(userId, exam.courseId, db);
  if (exam.createdById === userId) return true;
  return isAdmin(userId, db);
}

/** True if userId can edit this exam (course role, hoặc là người tạo/admin khi đề không gắn khoá học). */
export async function canEditExam(
  userId: string,
  exam: { courseId: string | null; createdById: string | null },
  db: DbClient = prisma,
): Promise<boolean> {
  return ownerOrCourseRole(userId, exam, canEditCourse, db);
}

/** True if userId can grade this exam (course role, hoặc là người tạo/admin khi đề không gắn khoá học). */
export async function canGradeExam(
  userId: string,
  exam: { courseId: string | null; createdById: string | null },
  db: DbClient = prisma,
): Promise<boolean> {
  return ownerOrCourseRole(userId, exam, canGradeCourse, db);
}

/** True if userId can moderate this exam live (course role, hoặc là người tạo/admin khi đề không gắn khoá học). */
export async function canModerateLiveExamForExam(
  userId: string,
  exam: { courseId: string | null; createdById: string | null },
  db: DbClient = prisma,
): Promise<boolean> {
  return ownerOrCourseRole(userId, exam, canModerateLiveExam, db);
}

/** Sửa nội dung đề (viết hoặc vấn đáp) — thay assertCanEditCourse khi thao tác trên 1 Exam cụ thể. */
export async function assertCanEditExam(
  userId: string,
  exam: { courseId: string | null; createdById: string | null },
  db: DbClient = prisma,
): Promise<void> {
  if (exam.courseId) {
    await assertCanEditCourse(userId, exam.courseId, db);
    return;
  }
  if (!(await canEditExam(userId, exam, db))) throw new CourseAuthzError("forbidden");
}

/** Chấm bài — thay assertCanGradeCourse khi thao tác trên 1 Exam cụ thể. */
export async function assertCanGradeExam(
  userId: string,
  exam: { courseId: string | null; createdById: string | null },
  db: DbClient = prisma,
): Promise<void> {
  if (exam.courseId) {
    await assertCanGradeCourse(userId, exam.courseId, db);
    return;
  }
  if (!(await canGradeExam(userId, exam, db))) throw new CourseAuthzError("forbidden");
}

/** Can thiệp lúc thi/nhắn tin — thay assertCanModerateLiveExam khi thao tác trên 1 Exam cụ thể. */
export async function assertCanModerateLiveExamForExam(
  userId: string,
  exam: { courseId: string | null; createdById: string | null },
  db: DbClient = prisma,
): Promise<void> {
  if (exam.courseId) {
    await assertCanModerateLiveExam(userId, exam.courseId, db);
    return;
  }
  if (!(await canModerateLiveExamForExam(userId, exam, db))) throw new CourseAuthzError("forbidden");
}

/**
 * True if userId is the `owner` CourseInstructor of the course, or a platform
 * admin. Stricter than `canEditCourse` — co-instructors can edit content but
 * not manage instructors / delete the course.
 */
export async function isCourseOwner(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  const [admin, ci] = await Promise.all([
    isAdmin(userId, db),
    db.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { role: true },
    }),
  ]);
  return admin || ci?.role === "owner";
}

/** Throws CourseAuthzError if the course doesn't exist or user isn't the owner. */
export async function assertIsOwner(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<void> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) throw new CourseAuthzError("not_found");
  const ok = await isCourseOwner(userId, courseId, db);
  if (!ok) throw new CourseAuthzError("forbidden");
}
