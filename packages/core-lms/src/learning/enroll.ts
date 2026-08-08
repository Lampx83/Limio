import { prisma, type Course, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "./events";
import { sendTemplatedEmail } from "../email/templates";

export class EnrollError extends Error {
  constructor(
    public readonly code:
      | "course_not_found"
      | "course_not_enrollable"
      | "payment_required"
      | "invalid_invite_code",
  ) {
    super(code);
  }
}

export interface EnrollResult {
  enrollmentId: string;
  courseVersion: number;
  created: boolean;
}

export interface EnrollOptions {
  skipPaymentCheck?: boolean;
  /** Base URL for links inside the welcome email. Skips welcome send if omitted. */
  baseUrl?: string;
  /** CourseSection to enroll into. Omit to fall back to the course's default section. */
  sectionId?: string;
}

/**
 * Resolve (creating if missing) the "Học viên chưa gán lớp" default
 * CourseSection for a course — the roster enrollments fall into when they
 * don't come through an invite link (direct free-enroll, paid checkout,
 * bulk-import). Mirrors the migration backfill for pre-A6 courses; new
 * courses get theirs lazily on first enrollment.
 */
export async function resolveDefaultSectionId(
  courseId: string,
  db: PrismaClient,
): Promise<string> {
  const existing = await db.courseSection.findFirst({
    where: { courseId, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;
  try {
    const created = await db.courseSection.create({
      data: { courseId, name: "Học viên chưa gán lớp", isDefault: true },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    // Race: another request created it concurrently — re-fetch instead of failing.
    if ((e as { code?: string }).code === "P2002") {
      const race = await db.courseSection.findFirst({
        where: { courseId, isDefault: true },
        select: { id: true },
      });
      if (race) return race.id;
    }
    throw e;
  }
}

async function createEnrollment(
  userId: string,
  course: Course,
  sectionId: string,
  db: PrismaClient,
  opts?: Pick<EnrollOptions, "baseUrl">,
): Promise<EnrollResult> {
  const enrollment = await db.enrollment.create({
    data: {
      userId,
      courseId: course.id,
      sectionId,
      courseVersion: course.version,
      status: "active",
    },
  });
  await emitEvent(
    userId,
    LearningEventType.EnrollmentCreated,
    {
      enrollmentId: enrollment.id,
      courseId: course.id,
      courseVersion: course.version,
      sectionId,
    },
    { courseId: course.id, eventKey: `enrollment.created:${enrollment.id}` },
    db,
  );

  // Welcome email — best-effort, never blocks enrollment. Skip if caller
  // didn't pass a baseUrl (e.g. internal calls, tests).
  if (opts?.baseUrl) {
    try {
      const user = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, displayName: true },
      });
      const courseUrl = `${opts.baseUrl.replace(/\/$/, "")}/learn/${course.slug}`;
      await sendTemplatedEmail({
        key: "course.welcome",
        to: user.email,
        organizationId: course.organizationId,
        variables: {
          learnerName: user.displayName,
          courseTitle: course.title,
          courseUrl,
        },
      });
    } catch {
      // Email failure must not break enrollment. Errors are surfaced via
      // sendEmail's SendResult, which we don't propagate here.
    }
  }

  return {
    enrollmentId: enrollment.id,
    courseVersion: enrollment.courseVersion,
    created: true,
  };
}

/** Shared idempotency + payment gate, used by both enrollInCourse and enrollBySectionCode. */
async function enrollUserInResolvedCourse(
  userId: string,
  course: Course,
  sectionId: string,
  db: PrismaClient,
  opts?: Pick<EnrollOptions, "skipPaymentCheck" | "baseUrl">,
): Promise<EnrollResult> {
  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });
  if (existing) {
    return {
      enrollmentId: existing.id,
      courseVersion: existing.courseVersion,
      created: false,
    };
  }

  // Paid course gating: must have a paid Order to enroll. Webhook auto-enrolls
  // on payment, so this branch fires only when self-enroll is attempted via UI.
  // Skip when payment is globally disabled (admin toggle).
  if (!opts?.skipPaymentCheck && course.priceCents !== null && course.priceCents > 0) {
    const paidOrder = await db.order.findFirst({
      where: { userId, courseId: course.id, status: "paid" },
    });
    if (!paidOrder) {
      throw new EnrollError("payment_required");
    }
  }

  return createEnrollment(userId, course, sectionId, db, { baseUrl: opts?.baseUrl });
}

/**
 * Enroll user into a course. Idempotent: if already enrolled, returns existing
 * enrollment with `created: false`.
 *
 * TODO(A9 — Payment): for paid courses, gate on `user.emailVerifiedAt !== null`
 * and on a successful payment intent. Phase 0 has no `Course.price` field —
 * all courses are free.
 */
export async function enrollInCourse(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
  opts?: EnrollOptions,
): Promise<EnrollResult> {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new EnrollError("course_not_found");
  if (course.status !== "published") {
    throw new EnrollError("course_not_enrollable");
  }

  const sectionId = opts?.sectionId ?? (await resolveDefaultSectionId(courseId, db));
  return enrollUserInResolvedCourse(userId, course, sectionId, db, opts);
}

/**
 * Self-enroll via a CourseSection invite link (`/join/[code]`). Idempotent
 * the same way as `enrollInCourse` — re-joining just returns the existing
 * enrollment. The default (isDefault=true) section is never invite-joinable.
 */
export async function enrollBySectionCode(
  userId: string,
  inviteCode: string,
  db: PrismaClient = prisma,
  opts?: Pick<EnrollOptions, "skipPaymentCheck" | "baseUrl">,
): Promise<EnrollResult> {
  const section = await db.courseSection.findUnique({
    where: { inviteCode },
    include: { course: true },
  });
  if (!section || section.isDefault) throw new EnrollError("invalid_invite_code");
  if (section.course.status !== "published") {
    throw new EnrollError("course_not_enrollable");
  }

  return enrollUserInResolvedCourse(userId, section.course, section.id, db, opts);
}

export async function isUserEnrolled(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const e = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, status: true },
  });
  return e !== null && e.status !== "dropped" && e.status !== "refunded";
}

export async function listEnrollmentsForUser(
  userId: string,
  db: PrismaClient = prisma,
) {
  return db.enrollment.findMany({
    where: { userId, status: { in: ["active", "completed"] } },
    orderBy: { enrolledAt: "desc" },
    include: {
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverUrl: true,
          level: true,
          language: true,
        },
      },
    },
  });
}
