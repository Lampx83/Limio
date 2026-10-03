import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { canEditCourse, canGradeCourse } from "../courses/authz";
import { emitEvent } from "./events";
import { isUserEnrolled } from "./enroll";

/**
 * Annotation theo vùng chọn (LessonAnnotation) + reply.
 *
 * Quy tắc hiển thị — chỗ dễ làm sai nhất của tính năng này:
 *  - Annotation mặc định RIÊNG TƯ: chỉ tác giả thấy.
 *  - Tác giả publish thì mọi người có quyền vào bài (đã ghi danh, hoặc là người
 *    dạy khoá) thấy được và reply được. Thu hồi về riêng tư thì cả annotation
 *    lẫn các reply biến khỏi mắt người khác (reply vẫn còn trong DB).
 *  - Reply chỉ có trên annotation ĐANG publish.
 *  - Người dạy (owner/co-instructor/admin) gỡ được annotation/reply công khai
 *    trong khoá mình — kiểm duyệt. Annotation riêng tư của người khác thì không
 *    ai gỡ được: với họ nó "không tồn tại".
 */

export const MAX_QUOTE = 1_000;
export const MAX_BODY = 2_000;
export const MAX_CONTEXT = 64;
/**
 * Loại khối có chữ để bôi đen. `teacher_note` KHÔNG BAO GIỜ được nằm ở đây: nó
 * chỉ dành cho người dạy, mà annotation công khai sẽ chép nguyên văn đoạn
 * trích sang cho cả lớp.
 */
export const ANNOTATABLE_TYPES: Array<"markdown" | "richtext"> = ["markdown", "richtext"];
const itemFilter = {
  isHidden: false,
  type: { in: ANNOTATABLE_TYPES },
};

/** Trần theo (người, bài) — chặn một vòng lặp lỗi hay spam làm phình bảng. */
export const MAX_ANNOTATIONS_PER_LESSON = 200;

export class AnnotationError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "lesson_not_found"
      | "not_enrolled"
      | "annotation_not_found"
      | "reply_not_found"
      | "not_published"
      | "too_many",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export const CreateAnnotationInput = z
  .object({
    contentItemId: z.string().uuid(),
    quote: z.string().min(1).max(MAX_QUOTE),
    prefix: z.string().max(MAX_CONTEXT).default(""),
    suffix: z.string().max(MAX_CONTEXT).default(""),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().positive(),
    body: z.string().trim().min(1).max(MAX_BODY),
    published: z.boolean().default(false),
  })
  .refine((v) => v.endOffset > v.startOffset, { message: "empty_range" });

export const UpdateAnnotationInput = z
  .object({
    body: z.string().trim().min(1).max(MAX_BODY).optional(),
    published: z.boolean().optional(),
  })
  .refine((v) => v.body !== undefined || v.published !== undefined, {
    message: "nothing_to_update",
  });

export const ReplyInput = z.object({
  body: z.string().trim().min(1).max(MAX_BODY),
});

export interface AnnotationReplyDto {
  id: string;
  body: string;
  createdAt: Date;
  author: { displayName: string };
  mine: boolean;
}

export interface AnnotationDto {
  id: string;
  contentItemId: string;
  quote: string;
  prefix: string;
  suffix: string;
  startOffset: number;
  endOffset: number;
  body: string;
  visibility: "private" | "published";
  createdAt: Date;
  author: { displayName: string };
  mine: boolean;
  replies: AnnotationReplyDto[];
}

interface Access {
  courseId: string;
  /** Có quyền kiểm duyệt nội dung công khai của khoá. */
  moderator: boolean;
}

async function resolveAccess(
  userId: string,
  lessonId: string,
  db: PrismaClient,
): Promise<Access> {
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isHidden: true,
      isLocked: true,
      module: { select: { courseId: true, isHidden: true, isLocked: true } },
    },
  });
  if (!row) throw new AnnotationError("lesson_not_found");
  const courseId = row.module.courseId;
  const [enrolled, grader, editor] = await Promise.all([
    isUserEnrolled(userId, courseId, db),
    canGradeCourse(userId, courseId, db),
    canEditCourse(userId, courseId, db),
  ]);
  if (!enrolled && !grader) throw new AnnotationError("not_enrolled");
  // Annotation công khai mang theo TRÍCH ĐOẠN nội dung bài. Bài/module đang ẩn
  // hoặc khoá với học viên thì endpoint này không được thành đường vòng để đọc
  // nội dung ấy — trang bài đã chặn, nhưng API gọi thẳng thì không qua trang.
  const closed = row.isHidden || row.isLocked || row.module.isHidden || row.module.isLocked;
  if (closed && !editor) throw new AnnotationError("lesson_not_found");
  return { courseId, moderator: editor };
}

const userSelect = { select: { displayName: true } } as const;

/**
 * Annotation của chính mình (cả riêng tư lẫn công khai) cộng annotation công
 * khai của người khác trong bài. Không bao giờ trả email hay id người khác —
 * chỉ tên hiển thị.
 */
export async function listLessonAnnotations(
  userId: string,
  lessonId: string,
  db: PrismaClient = prisma,
): Promise<AnnotationDto[]> {
  await resolveAccess(userId, lessonId, db);
  const rows = await db.lessonAnnotation.findMany({
    where: {
      lessonId,
      OR: [{ userId }, { visibility: "published" }],
      // Khối bị ẩn/đổi loại sau khi đã có annotation thì annotation cũng khuất.
      contentItem: itemFilter,
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: userSelect,
      replies: { orderBy: { createdAt: "asc" }, include: { user: userSelect } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    contentItemId: a.contentItemId,
    quote: a.quote,
    prefix: a.prefix,
    suffix: a.suffix,
    startOffset: a.startOffset,
    endOffset: a.endOffset,
    body: a.body,
    visibility: a.visibility,
    createdAt: a.createdAt,
    author: { displayName: a.user.displayName },
    mine: a.userId === userId,
    // Annotation riêng tư không có reply hiển thị được (xem đầu file).
    replies:
      a.visibility === "published"
        ? a.replies.map((r) => ({
            id: r.id,
            body: r.body,
            createdAt: r.createdAt,
            author: { displayName: r.user.displayName },
            mine: r.userId === userId,
          }))
        : [],
  }));
}

export async function createAnnotation(
  userId: string,
  lessonId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ annotationId: string }> {
  const { courseId } = await resolveAccess(userId, lessonId, db);
  const parsed = CreateAnnotationInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new AnnotationError("validation_failed", parsed.error.flatten());
  }
  const input = parsed.data;

  // Khối nội dung phải thuộc ĐÚNG bài này — không thì có thể ghim annotation
  // vào bài của khoá mình không học.
  const item = await db.contentItem.findFirst({
    where: { id: input.contentItemId, lessonId, ...itemFilter },
    select: { id: true },
  });
  if (!item) throw new AnnotationError("validation_failed", "content_item_not_in_lesson");

  const count = await db.lessonAnnotation.count({ where: { userId, lessonId } });
  if (count >= MAX_ANNOTATIONS_PER_LESSON) throw new AnnotationError("too_many");

  return db.$transaction(async (tx) => {
    const a = await tx.lessonAnnotation.create({
      data: {
        userId,
        lessonId,
        contentItemId: input.contentItemId,
        quote: input.quote,
        prefix: input.prefix,
        suffix: input.suffix,
        startOffset: input.startOffset,
        endOffset: input.endOffset,
        body: input.body,
        visibility: input.published ? "published" : "private",
        publishedAt: input.published ? new Date() : null,
      },
    });
    await emitEvent(
      userId,
      LearningEventType.LessonAnnotationCreated,
      {
        annotationId: a.id,
        lessonId,
        contentItemId: input.contentItemId,
        quoteLength: input.quote.length,
        bodyLength: input.body.length,
        published: input.published,
      },
      { courseId },
      tx,
    );
    return { annotationId: a.id };
  });
}

/** Tác giả sửa chữ ghi chú và/hoặc bật-tắt công khai. */
export async function updateAnnotation(
  userId: string,
  annotationId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const existing = await db.lessonAnnotation.findUnique({
    where: { id: annotationId },
    select: {
      userId: true,
      lessonId: true,
      visibility: true,
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  // Của người khác thì cũng "không tồn tại" — không lộ rằng nó có thật.
  if (!existing || existing.userId !== userId) {
    throw new AnnotationError("annotation_not_found");
  }
  const parsed = UpdateAnnotationInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new AnnotationError("validation_failed", parsed.error.flatten());
  }
  const { body, published } = parsed.data;
  const courseId = existing.lesson.module.courseId;

  await db.$transaction(async (tx) => {
    const data: {
      body?: string;
      visibility?: "private" | "published";
      publishedAt?: Date | null;
    } = {};
    if (body !== undefined) data.body = body;
    const wasPublished = existing.visibility === "published";
    const flip = published !== undefined && published !== wasPublished;
    if (flip) {
      data.visibility = published ? "published" : "private";
      data.publishedAt = published ? new Date() : null;
    }
    await tx.lessonAnnotation.update({ where: { id: annotationId }, data });
    if (flip) {
      await emitEvent(
        userId,
        LearningEventType.LessonAnnotationPublished,
        { annotationId, lessonId: existing.lessonId, published: !!published },
        { courseId },
        tx,
      );
    }
  });
}

export async function deleteAnnotation(
  userId: string,
  annotationId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const a = await db.lessonAnnotation.findUnique({
    where: { id: annotationId },
    select: {
      userId: true,
      lessonId: true,
      visibility: true,
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  if (!a) throw new AnnotationError("annotation_not_found");
  const courseId = a.lesson.module.courseId;
  const isAuthor = a.userId === userId;
  let by: "author" | "moderator" = "author";
  if (!isAuthor) {
    // Chỉ gỡ được nội dung công khai; riêng tư của người khác thì như không có.
    if (a.visibility !== "published") throw new AnnotationError("annotation_not_found");
    if (!(await canEditCourse(userId, courseId, db))) {
      throw new AnnotationError("annotation_not_found");
    }
    by = "moderator";
  }
  await db.$transaction(async (tx) => {
    await tx.lessonAnnotation.delete({ where: { id: annotationId } });
    await emitEvent(
      userId,
      LearningEventType.LessonAnnotationRemoved,
      { kind: "annotation", targetId: annotationId, lessonId: a.lessonId, by },
      { courseId },
      tx,
    );
  });
}

export async function createAnnotationReply(
  userId: string,
  annotationId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ replyId: string }> {
  const a = await db.lessonAnnotation.findUnique({
    where: { id: annotationId },
    select: { userId: true, lessonId: true, visibility: true },
  });
  if (!a) throw new AnnotationError("annotation_not_found");
  const { courseId } = await resolveAccess(userId, a.lessonId, db);
  // Riêng tư của người khác: không lộ sự tồn tại. Của chính mình mà chưa
  // publish: nói rõ để UI hướng dẫn "hãy publish trước".
  if (a.visibility !== "published") {
    throw new AnnotationError(
      a.userId === userId ? "not_published" : "annotation_not_found",
    );
  }
  const parsed = ReplyInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new AnnotationError("validation_failed", parsed.error.flatten());
  }
  return db.$transaction(async (tx) => {
    const r = await tx.lessonAnnotationReply.create({
      data: { annotationId, userId, body: parsed.data.body },
    });
    await emitEvent(
      userId,
      LearningEventType.LessonAnnotationReplied,
      {
        annotationId,
        replyId: r.id,
        lessonId: a.lessonId,
        annotationAuthorId: a.userId,
      },
      { courseId },
      tx,
    );
    return { replyId: r.id };
  });
}

export async function deleteAnnotationReply(
  userId: string,
  replyId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const r = await db.lessonAnnotationReply.findUnique({
    where: { id: replyId },
    select: {
      userId: true,
      annotation: {
        select: {
          userId: true,
          lessonId: true,
          visibility: true,
          lesson: { select: { module: { select: { courseId: true } } } },
        },
      },
    },
  });
  if (!r) throw new AnnotationError("reply_not_found");
  const courseId = r.annotation.lesson.module.courseId;
  const isAuthor = r.userId === userId;
  let by: "author" | "moderator" = "author";
  if (!isAuthor) {
    if (
      r.annotation.visibility !== "published" ||
      !(await canEditCourse(userId, courseId, db))
    ) {
      throw new AnnotationError("reply_not_found");
    }
    by = "moderator";
  }
  await db.$transaction(async (tx) => {
    await tx.lessonAnnotationReply.delete({ where: { id: replyId } });
    await emitEvent(
      userId,
      LearningEventType.LessonAnnotationRemoved,
      { kind: "reply", targetId: replyId, lessonId: r.annotation.lessonId, by },
      { courseId },
      tx,
    );
  });
}
