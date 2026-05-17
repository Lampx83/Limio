import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "./events";
import { sendTemplatedEmail } from "../email/templates";

export class EnrollError extends Error {
  constructor(
    public readonly code:
      | "course_not_found"
      | "course_not_enrollable"
      | "payment_required",
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

  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
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
      where: { userId, courseId, status: "paid" },
    });
    if (!paidOrder) {
      throw new EnrollError("payment_required");
    }
  }

  const enrollment = await db.enrollment.create({
    data: {
      userId,
      courseId,
      courseVersion: course.version,
      status: "active",
    },
  });
  await emitEvent(
    userId,
    LearningEventType.EnrollmentCreated,
    { enrollmentId: enrollment.id, courseId, courseVersion: course.version },
    { courseId, eventKey: `enrollment.created:${enrollment.id}` },
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
