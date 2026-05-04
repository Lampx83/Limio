import { z } from "zod";
import { prisma, type Prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";
import { validateContentPayload, type ContentTypeKey } from "./contentSchemas";

const TypeEnum = z.enum(["video", "markdown", "embed", "file", "external_link", "pdf", "scorm", "lti", "h5p"]);

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

  const item = await db.contentItem.create({
    data: {
      lessonId,
      type: parsed.data.type,
      payload: validatedPayload as Prisma.InputJsonValue,
      orderIndex: parsed.data.orderIndex,
    },
  });
  return { contentItemId: item.id };
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

export async function deleteContentItem(
  actorUserId: string,
  contentId: string,
  db: DbClient = prisma,
): Promise<void> {
  const ctx = await getCourseIdForContent(contentId, db);
  await assertCanEditCourse(actorUserId, ctx.courseId, db);
  await db.contentItem.delete({ where: { id: contentId } });
}
