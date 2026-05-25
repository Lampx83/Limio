import { z } from "zod";
import { prisma, type Prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";
import { validateContentPayload, type ContentTypeKey } from "./contentSchemas";
import { attachLessonActivity } from "./lessonActivity";

const TypeEnum = z.enum(["video", "markdown", "richtext", "embed", "file", "external_link", "pdf", "scorm", "lti", "h5p"]);

export const CreateContentInput = z.object({
  type: TypeEnum,
  payload: z.unknown(),
  orderIndex: z.number().int().nonnegative(),
});

export const UpdateContentInput = z.object({
  type: TypeEnum.optional(),
  payload: z.unknown().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  isHidden: z.boolean().optional(),
});

async function getCourseIdForLesson(lessonId: string, db: DbClient): Promise<string> {
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!row) throw new CourseAuthzError("not_found");
  return row.module.courseId;
}

async function getCourseIdForContent(contentId: string, db: DbClient): Promise<{
  courseId: string;
  lessonId: string;
  type: ContentTypeKey;
}> {
  const row = await db.contentItem.findUnique({
    where: { id: contentId },
    select: {
      lessonId: true,
      type: true,
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  if (!row) throw new CourseAuthzError("not_found");
  return {
    courseId: row.lesson.module.courseId,
    lessonId: row.lessonId,
    type: row.type as ContentTypeKey,
  };
}

export async function createContentItem(
  actorUserId: string,
  lessonId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<{ contentItemId: string }> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = CreateContentInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());

  let validatedPayload: Record<string, unknown>;
  try {
    validatedPayload = validateContentPayload(parsed.data.type, parsed.data.payload);
  } catch (e) {
    throw new CourseError(
      "validation_failed",
      e instanceof z.ZodError ? e.flatten() : String(e),
    );
  }

  // Wrap entity create + LessonActivity attach in one transaction so a failure
  // attaching to the ordering layer rolls back the entity create.
  const itemId = await (db as typeof prisma).$transaction(async (tx) => {
    const item = await tx.contentItem.create({
      data: {
        lessonId,
        type: parsed.data.type,
        payload: validatedPayload as Prisma.InputJsonValue,
        orderIndex: parsed.data.orderIndex,
      },
    });
    await attachLessonActivity(tx, lessonId, "content", item.id);
    return item.id;
  });
  return { contentItemId: itemId };
}

export async function updateContentItem(
  actorUserId: string,
  contentId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const ctx = await getCourseIdForContent(contentId, db);
  await assertCanEditCourse(actorUserId, ctx.courseId, db);
  const parsed = UpdateContentInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());

  // If payload provided, re-validate against (possibly new) type.
  const data: Prisma.ContentItemUpdateInput = {};
  const effectiveType = parsed.data.type ?? ctx.type;
  if (parsed.data.payload !== undefined) {
    try {
      data.payload = validateContentPayload(effectiveType, parsed.data.payload) as Prisma.InputJsonValue;
    } catch (e) {
      throw new CourseError(
        "validation_failed",
        e instanceof z.ZodError ? e.flatten() : String(e),
      );
    }
  }
  if (parsed.data.type !== undefined) data.type = parsed.data.type;
  if (parsed.data.orderIndex !== undefined) data.orderIndex = parsed.data.orderIndex;
  if (parsed.data.isHidden !== undefined) data.isHidden = parsed.data.isHidden;
  if (Object.keys(data).length === 0) return;
  await db.contentItem.update({ where: { id: contentId }, data });
}

/**
 * Reorder ContentItems within a lesson. Caller must provide the full set of
 * IDs currently attached to the lesson — partial reorder is rejected to keep
 * the orderIndex sequence dense and predictable. Two-pass update so future
 * (lessonId, orderIndex) unique indexes won't deadlock if added later.
 */
export async function reorderContentItems(
  actorUserId: string,
  lessonId: string,
  orderedContentItemIds: string[],
  db: DbClient = prisma,
): Promise<void> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  await assertCanEditCourse(actorUserId, courseId, db);

  const existing = await db.contentItem.findMany({
    where: { lessonId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((c) => c.id));
  for (const id of orderedContentItemIds) {
    if (!existingIds.has(id)) {
      throw new CourseError("validation_failed", `unknown_content_item:${id}`);
    }
  }
  if (orderedContentItemIds.length !== existingIds.size) {
    throw new CourseError("validation_failed", "must_include_all_content_items");
  }

  await (db as typeof prisma).$transaction(async (tx) => {
    for (let i = 0; i < orderedContentItemIds.length; i++) {
      await tx.contentItem.update({
        where: { id: orderedContentItemIds[i]! },
        data: { orderIndex: -1 - i },
      });
    }
    for (let i = 0; i < orderedContentItemIds.length; i++) {
      await tx.contentItem.update({
        where: { id: orderedContentItemIds[i]! },
        data: { orderIndex: i },
      });
    }
  });
}

export async function deleteContentItem(
  actorUserId: string,
  contentId: string,
  db: DbClient = prisma,
): Promise<void> {
  const ctx = await getCourseIdForContent(contentId, db);
  await assertCanEditCourse(actorUserId, ctx.courseId, db);
  await db.contentItem.delete({ where: { id: contentId } });
}
