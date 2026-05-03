import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  assertCanEditCourse,
  CourseAuthzError,
  emitEvent,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_ROWS = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: Request,
  { params }: { params: { courseId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await assertCanEditCourse(userId, params.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.students)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const students = body.students as Array<{ name: string; email: string }>;
  if (students.length === 0) {
    return NextResponse.json({ error: "empty_list" }, { status: 400 });
  }
  if (students.length > MAX_ROWS) {
    return NextResponse.json({ error: "too_many_rows", limit: MAX_ROWS }, { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { id: true, version: true },
  });
  if (!course) return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  const learnerRole = await prisma.role.findUnique({ where: { name: "learner" } });
  if (!learnerRole) {
    return NextResponse.json({ error: "role_seed_missing" }, { status: 500 });
  }

  let enrolled = 0;
  let alreadyEnrolled = 0;
  let created = 0;
  const errors: Array<{ row: number; email: string; error: string }> = [];

  for (let i = 0; i < students.length; i++) {
    const rawName = students[i]?.name;
    const rawEmail = students[i]?.email;
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    const displayName = typeof rawName === "string" ? rawName.trim() : "";

    if (!EMAIL_RE.test(email)) {
      errors.push({ row: i + 1, email: rawEmail ?? "", error: "Email không hợp lệ" });
      continue;
    }
    if (!displayName) {
      errors.push({ row: i + 1, email, error: "Tên không được bỏ trống" });
      continue;
    }

    try {
      // Find or create user by email
      let target = await prisma.user.findUnique({ where: { email } });
      if (!target) {
        target = await prisma.user.create({
          data: {
            id: randomUUID(),
            email,
            displayName,
            passwordHash: null,
            emailVerifiedAt: null,
          },
        });
        created++;
      }

      // Ensure platform-wide learner role
      const hasRole = await prisma.userRole.findFirst({
        where: { userId: target.id, roleId: learnerRole.id, courseId: null },
      });
      if (!hasRole) {
        await prisma.userRole.create({
          data: { userId: target.id, roleId: learnerRole.id, courseId: null, grantedBy: userId },
        });
      }

      // Enroll (idempotent; re-activate dropped/refunded)
      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: target.id, courseId: course.id } },
      });

      if (existing && (existing.status === "active" || existing.status === "completed")) {
        alreadyEnrolled++;
      } else if (existing) {
        // Re-activate a dropped / refunded enrollment
        await prisma.enrollment.update({
          where: { id: existing.id },
          data: { status: "active", enrolledAt: new Date() },
        });
        enrolled++;
      } else {
        const enrollment = await prisma.enrollment.create({
          data: {
            userId: target.id,
            courseId: course.id,
            courseVersion: course.version,
            status: "active",
          },
        });
        await emitEvent(
          target.id,
          LearningEventType.EnrollmentCreated,
          { enrollmentId: enrollment.id, courseId: course.id, courseVersion: course.version, importedBy: userId },
          { courseId: course.id, eventKey: `enrollment.created:${enrollment.id}` },
        );
        enrolled++;
      }
    } catch {
      errors.push({ row: i + 1, email, error: "Lỗi xử lý, thử lại sau" });
    }
  }

  return NextResponse.json({ enrolled, alreadyEnrolled, created, errors });
}
