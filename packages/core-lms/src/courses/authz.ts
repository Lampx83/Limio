import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin } from "../auth/roles";

/**
 * True if userId is an instructor on the given course (CourseInstructor) OR a platform admin.
 * Throws if course not found.
 */
export async function canEditCourse(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  const [admin, ci] = await Promise.all([
    isAdmin(userId, db),
    db.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { id: true },
    }),
  ]);
  return admin || ci !== null;
}

export class CourseAuthzError extends Error {
  constructor(public readonly code: "forbidden" | "not_found") {
    super(code);
  }
}

/** Throws CourseAuthzError if the course doesn't exist or user can't edit it. */
export async function assertCanEditCourse(
  userId: string,
  courseId: string,
  db: DbClient = prisma,
): Promise<void> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) throw new CourseAuthzError("not_found");
  const ok = await canEditCourse(userId, courseId, db);
  if (!ok) throw new CourseAuthzError("forbidden");
}
