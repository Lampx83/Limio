import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "./events";
import { isUserEnrolled } from "./enroll";

export const ViewInput = z.object({
  positionSec: z.number().int().nonnegative(),
  durationSec: z.number().int().positive().optional(),
});

export class LearningError extends Error {
  constructor(
    public readonly code:
      | "lesson_not_found"
      | "not_enrolled"
      | "validation_failed",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

interface LessonContext {
  lessonId: string;
  courseId: string;
}

async function getLessonContext(
  lessonId: string,
  db: PrismaClient,
): Promise<LessonContext | null> {
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { courseId: true } } },
  });
  if (!row) return null;
  return { lessonId: row.id, courseId: row.module.courseId };
}

export interface TrackViewResult {
  /** Course this lesson lives under — lets the caller wire gamification (streak) without a re-query. */
  courseId: string;
}

/**
 * Heartbeat — caller should hit this every ~10s while watching a video,
 * or once on lesson load for non-video content.
 * Updates Enrollment.lastLessonId / lastPositionSec and emits `lesson.viewed`.
 */
export async function trackLessonView(
  userId: string,
  lessonId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<TrackViewResult> {
  const ctx = await getLessonContext(lessonId, db);
  if (!ctx) throw new LearningError("lesson_not_found");
  if (!(await isUserEnrolled(userId, ctx.courseId, db))) {
    throw new LearningError("not_enrolled");
  }
  const parsed = ViewInput.safeParse(rawInput);
  if (!parsed.success) throw new LearningError("validation_failed", parsed.error.flatten());

  await db.enrollment.update({
    where: { userId_courseId: { userId, courseId: ctx.courseId } },
    data: { lastLessonId: lessonId, lastPositionSec: parsed.data.positionSec },
  });
  await emitEvent(
    userId,
    LearningEventType.LessonViewed,
    {
      lessonId,
      positionSec: parsed.data.positionSec,
      durationSec: parsed.data.durationSec,
    },
    { courseId: ctx.courseId },
    db,
  );
  return { courseId: ctx.courseId };
}

export interface CompleteResult {
  lessonId: string;
  /** Course this lesson lives under — useful for downstream handlers. */
  courseId: string;
  /** True if this call moved the lesson into the completed set (not a no-op). */
  newlyCompleted: boolean;
  /** True if completing this lesson also completed the whole course (per user). */
  courseCompleted: boolean;
}

/**
 * Mark a lesson complete. Idempotent. If this completes the final lesson
 * of the course, also emits `course.completed` (idempotent per course version).
 */
export type LessonCompleteReason =
  | "marked_complete"
  | "watched_threshold"
  | "all_activities_completed" // every quiz passed + every assignment submitted
  | "scrolled_to_end" // text/embed-only lesson — learner reached the bottom
  | "skipped"; // B4 — learner accepted the "you can skip this" suggestion

export async function completeLesson(
  userId: string,
  lessonId: string,
  reason: LessonCompleteReason = "marked_complete",
  db: PrismaClient = prisma,
): Promise<CompleteResult> {
  const ctx = await getLessonContext(lessonId, db);
  if (!ctx) throw new LearningError("lesson_not_found");
  if (!(await isUserEnrolled(userId, ctx.courseId, db))) {
    throw new LearningError("not_enrolled");
  }

  const emit = await emitEvent(
    userId,
    LearningEventType.LessonCompleted,
    { lessonId, reason },
    {
      courseId: ctx.courseId,
      eventKey: `lesson.completed:${userId}:${lessonId}`,
    },
    db,
  );

  // Check whether all lessons in the course are now done for this user.
  const [completedCount, totalCount, enrollment] = await Promise.all([
    db.learningEvent.count({
      where: {
        userId,
        courseId: ctx.courseId,
        eventType: LearningEventType.LessonCompleted,
      },
    }),
    db.lesson.count({ where: { module: { courseId: ctx.courseId } } }),
    db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: ctx.courseId } },
      select: { courseVersion: true, completedAt: true },
    }),
  ]);

  let courseCompleted = false;
  if (totalCount > 0 && completedCount >= totalCount && enrollment) {
    const result = await emitEvent(
      userId,
      LearningEventType.CourseCompleted,
      { courseId: ctx.courseId, courseVersion: enrollment.courseVersion },
      {
        courseId: ctx.courseId,
        eventKey: `course.completed:${userId}:${ctx.courseId}:${enrollment.courseVersion}`,
      },
      db,
    );
    courseCompleted = result.created;
    if (result.created && !enrollment.completedAt) {
      await db.enrollment.update({
        where: { userId_courseId: { userId, courseId: ctx.courseId } },
        data: { status: "completed", completedAt: new Date() },
      });
    }
  }

  return {
    lessonId,
    courseId: ctx.courseId,
    newlyCompleted: emit.created,
    courseCompleted,
  };
}
