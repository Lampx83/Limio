import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  assertCanEditCourse,
  CourseAuthzError,
  emitEvent,
  transferEnrollmentSection,
  unenrollStudent,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const VALID_STATUSES = ["active", "completed", "dropped", "refunded"] as const;
type Status = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: Request,
  { params }: { params: { courseId: string; enrollmentId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await assertCanEditCourse(userId, params.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return NextResponse.json(
        {
          error: err.code === "not_found" ? "course_not_found" : "forbidden",
        },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const body = await req.json().catch(() => null);

  const nextSectionId = body?.sectionId as string | undefined;
  if (nextSectionId) {
    try {
      await transferEnrollmentSection(userId, params.enrollmentId, nextSectionId);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const mapped = mapKnownError(e);
      if (mapped) return mapped;
      throw e;
    }
  }

  const nextStatus = body?.status as Status | undefined;
  if (!nextStatus || !VALID_STATUSES.includes(nextStatus)) {
    return NextResponse.json(
      { error: "validation_failed", message: "status required" },
      { status: 400 },
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.enrollmentId },
  });
  if (!enrollment || enrollment.courseId !== params.courseId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (enrollment.status === nextStatus) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const updated = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === "completed" ? new Date() : null,
    },
  });

  await emitEvent(
    enrollment.userId,
    LearningEventType.EnrollmentStatusChanged,
    {
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      from: enrollment.status,
      to: nextStatus,
      changedBy: userId,
    },
    {
      courseId: enrollment.courseId,
      eventKey: `enrollment.status_changed:${enrollment.id}:${Date.now()}`,
    },
  );

  return NextResponse.json({ ok: true, status: updated.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { courseId: string; enrollmentId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.enrollmentId },
  });
  if (!enrollment || enrollment.courseId !== params.courseId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await unenrollStudent(userId, params.enrollmentId);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  return NextResponse.json({ ok: true });
}
