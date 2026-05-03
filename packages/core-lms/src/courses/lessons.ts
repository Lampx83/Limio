import { z } from "zod";
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";

export const CreateLessonInput = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2_000).optional(),
  orderIndex: z.number().int().nonnegative(),
  completionThresholdPct: z.number().int().min(1).max(100).optional(),
  durationSec: z.number().int().nonnegative().optional(),
});

export const UpdateLessonInput = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2_000).optional().nullable(),
  orderIndex: z.number().int().nonnegative().optional(),
  completionThresholdPct: z.number().int().min(1).max(100).optional().nullable(),
  durationSec: z.number().int().nonnegative().optional().nullable(),
  previewable: z.boolean().optional(),
});

async function getCourseIdForLesson(lessonId: string, db: DbClient): Promise<string> {
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!row) throw new CourseAuthzError("not_found");
  return row.module.courseId;
}

export async function createLesson(
  actorUserId: string,
  moduleId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<{ lessonId: string }> {
  const mod = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
  if (!mod) throw new CourseAuthzError("not_found");
  await assertCanEditCourse(actorUserId, mod.courseId, db);
  const parsed = CreateLessonInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());
  const l = await db.lesson.create({ data: { moduleId, ...parsed.data } });
  return { lessonId: l.id };
}

export async function updateLesson(
  actorUserId: string,
  lessonId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = UpdateLessonInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length === 0) return;
  await db.lesson.update({ where: { id: lessonId }, data });
}

export async function deleteLesson(
  actorUserId: string,
  lessonId: string,
  db: DbClient = prisma,
): Promise<void> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  await db.lesson.delete({ where: { id: lessonId } });
}

/**
 * Reorder lessons within a module. 2-pass update to dodge the
 * (moduleId, orderIndex) unique constraint.
 */
export async function reorderLessons(
  actorUserId: string,
  moduleId: string,
  orderedLessonIds: string[],
  db: DbClient = prisma,
): Promise<void> {
  const mod = await db.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  });
  if (!mod) throw new CourseError("validation_failed", "module_not_found");
  await assertCanEditCourse(actorUserId, mod.courseId, db);
  const existing = await db.lesson.findMany({
    where: { moduleId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((l) => l.id));
  for (const id of orderedLessonIds) {
    if (!existingIds.has(id)) throw new CourseError("validation_failed", `unknown_lesson:${id}`);
  }
  if (orderedLessonIds.length !== existingIds.size) {
    throw new CourseError("validation_failed", "must_include_all_lessons");
  }
  await (db as typeof prisma).$transaction(async (tx) => {
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await tx.lesson.update({
        where: { id: orderedLessonIds[i]! },
        data: { orderIndex: -1 - i },
      });
    }
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await tx.lesson.update({
        where: { id: orderedLessonIds[i]! },
        data: { orderIndex: i },
      });
    }
  });
}
