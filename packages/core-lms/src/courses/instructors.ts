/**
 * Co-instructor management — owner attaches another instructor by email,
 * no invite/accept step. If the email doesn't have an account yet, one is
 * created for them (no password) and a "set your password" email is sent,
 * same pattern as `inviteUserAsProctor` (exam-rounds.ts). If the email
 * already has an account, they're granted access immediately — next login
 * they see the course.
 *
 * Authz: only the course `owner` can add/remove instructors (assertIsOwner).
 * Co-instructors get the same content-edit rights as owner via the existing
 * assertCanEditCourse (unchanged) — this module only guards instructor
 * management itself.
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { findOrInviteUserByEmail } from "../auth/invite";
import { emitEvent } from "../learning/events";
import { assertIsOwner } from "./authz";
import { CourseError } from "./courses";

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
  await assertIsOwner(actorUserId, courseId, db);

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

/** Remove a co-instructor. The `owner` row cannot be removed through here. */
export async function removeCoInstructor(
  actorUserId: string,
  courseId: string,
  targetUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertIsOwner(actorUserId, courseId, db);

  const row = await db.courseInstructor.findUnique({
    where: { courseId_userId: { courseId, userId: targetUserId } },
    select: { role: true },
  });
  if (!row) throw new CourseError("instructor_not_found");
  if (row.role === "owner") throw new CourseError("cannot_remove_owner");

  await db.courseInstructor.delete({
    where: { courseId_userId: { courseId, userId: targetUserId } },
  });

  await emitEvent(
    actorUserId,
    LearningEventType.CourseInstructorRemoved,
    { courseId, removedUserId: targetUserId },
    { courseId, eventKey: `course.instructor.removed:${courseId}:${targetUserId}:${Date.now()}` },
    db,
  );
}
