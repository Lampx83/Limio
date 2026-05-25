import { prisma, type PrismaClient, type Prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse } from "./authz";
import { CourseError } from "./courses";

/**
 * LessonActivity is the unified ordering layer for lesson-attached activities
 * (ContentItem + Quiz + Assignment). One row per activity; `kind` discriminates
 * which of the three nullable FKs is populated. Drag-drop reorder writes ONLY
 * to this table — underlying entities are untouched.
 *
 * Excluded from LessonActivity (NO row inserted):
 *   - Quiz.cuepointOnly = true (lives inside a video cuepoint, not in the timeline)
 *   - Quiz.tournamentMissionId != null (lives in tournament UI)
 *   - Assignment.tournamentMissionId != null (lives in tournament UI)
 *   - Quiz / Assignment without lessonId (course-scoped or tournament-only)
 *
 * Cascade: ON DELETE CASCADE on each FK — when a ContentItem / Quiz / Assignment
 * is deleted, its LessonActivity row goes with it. No application-side cleanup
 * needed for the delete path.
 */

type AttachKind = "content" | "quiz" | "assignment";

/**
 * Insert a LessonActivity row at the end of the lesson's activity list. Call
 * this from inside the same transaction that creates the underlying entity, so
 * a failure here rolls back the entity create too.
 *
 * Idempotent on (lessonId, refId) — if a row already exists for this entity
 * (e.g., backfill ran), this is a no-op.
 */
export async function attachLessonActivity(
  tx: Prisma.TransactionClient,
  lessonId: string,
  kind: AttachKind,
  refId: string,
): Promise<void> {
  // Idempotency check — backfill or prior call may have already inserted.
  const existing = await tx.lessonActivity.findFirst({
    where:
      kind === "content"
        ? { contentItemId: refId }
        : kind === "quiz"
          ? { quizId: refId }
          : { assignmentId: refId },
    select: { id: true },
  });
  if (existing) return;

  const max = await tx.lessonActivity.aggregate({
    where: { lessonId },
    _max: { orderIndex: true },
  });
  const nextIdx = (max._max.orderIndex ?? -1) + 1;
  await tx.lessonActivity.create({
    data: {
      lessonId,
      kind,
      orderIndex: nextIdx,
      contentItemId: kind === "content" ? refId : null,
      quizId: kind === "quiz" ? refId : null,
      assignmentId: kind === "assignment" ? refId : null,
    },
  });
}

/**
 * Reorder all activities (content + quiz + assignment) within a lesson. Caller
 * must pass the FULL set of LessonActivity ids currently in the lesson —
 * partial reorder is rejected.
 *
 * Two-pass write to dodge the `(lessonId, orderIndex)` unique constraint:
 *   pass 1 → write negative offsets so no two rows collide
 *   pass 2 → write the final 0..N-1 sequence
 */
export async function reorderLessonActivities(
  actorUserId: string,
  lessonId: string,
  orderedActivityIds: string[],
  db: DbClient = prisma,
): Promise<void> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) throw new CourseError("validation_failed", "lesson_not_found");
  await assertCanEditCourse(actorUserId, lesson.module.courseId, db);

  const existing = await db.lessonActivity.findMany({
    where: { lessonId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((a) => a.id));
  for (const id of orderedActivityIds) {
    if (!existingIds.has(id)) {
      throw new CourseError("validation_failed", `unknown_activity:${id}`);
    }
  }
  if (orderedActivityIds.length !== existingIds.size) {
    throw new CourseError("validation_failed", "must_include_all_activities");
  }

  // Load kind + contentItemId so we can propagate the new position back to
  // ContentItem.orderIndex too. Learner-side rendering still sorts content
  // items by their own orderIndex column (legacy code path); keeping them in
  // sync avoids divergence between what the instructor arranges and what the
  // learner sees. Quiz + Assignment don't have an orderIndex column so they
  // stay implicit (their lesson position lives only on LessonActivity).
  const rows = await db.lessonActivity.findMany({
    where: { id: { in: orderedActivityIds } },
    select: { id: true, contentItemId: true },
  });
  const contentByActivityId = new Map(
    rows
      .filter((r) => r.contentItemId !== null)
      .map((r) => [r.id, r.contentItemId as string]),
  );

  await (db as PrismaClient).$transaction(async (tx) => {
    // Pass 1: negative offsets to dodge unique (lessonId, orderIndex) collisions
    // on both LessonActivity and ContentItem.
    for (let i = 0; i < orderedActivityIds.length; i++) {
      const activityId = orderedActivityIds[i]!;
      await tx.lessonActivity.update({
        where: { id: activityId },
        data: { orderIndex: -1 - i },
      });
      const contentId = contentByActivityId.get(activityId);
      if (contentId) {
        await tx.contentItem.update({
          where: { id: contentId },
          data: { orderIndex: -1 - i },
        });
      }
    }
    // Pass 2: final 0..N-1 sequence.
    for (let i = 0; i < orderedActivityIds.length; i++) {
      const activityId = orderedActivityIds[i]!;
      await tx.lessonActivity.update({
        where: { id: activityId },
        data: { orderIndex: i },
      });
      const contentId = contentByActivityId.get(activityId);
      if (contentId) {
        await tx.contentItem.update({
          where: { id: contentId },
          data: { orderIndex: i },
        });
      }
    }
  });
}
