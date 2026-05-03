import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isUserEnrolled } from "./enroll";
import { emitEvent } from "./events";

export class ForumError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "lesson_not_found"
      | "thread_not_found"
      | "post_not_found"
      | "not_enrolled"
      | "forbidden",
  ) {
    super(code);
  }
}

const NewThreadInput = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
});

const NewPostInput = z.object({
  body: z.string().trim().min(1).max(10_000),
});

async function loadLessonCourse(lessonId: string, db: PrismaClient) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) throw new ForumError("lesson_not_found");
  return lesson.module.courseId;
}

export async function createThread(
  userId: string,
  lessonId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const courseId = await loadLessonCourse(lessonId, db);
  if (!(await isUserEnrolled(userId, courseId, db))) {
    throw new ForumError("not_enrolled");
  }
  const parsed = NewThreadInput.safeParse(rawInput);
  if (!parsed.success) throw new ForumError("validation_failed");

  const thread = await db.forumThread.create({
    data: {
      lessonId,
      authorId: userId,
      title: parsed.data.title,
      body: parsed.data.body,
    },
  });
  await emitEvent(
    userId,
    LearningEventType.ForumPosted,
    { threadId: thread.id, lessonId, kind: "thread" },
    { courseId },
    db,
  );
  return { threadId: thread.id };
}

export async function postReply(
  userId: string,
  threadId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    select: { id: true, lessonId: true, lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!thread) throw new ForumError("thread_not_found");
  const courseId = thread.lesson.module.courseId;
  if (!(await isUserEnrolled(userId, courseId, db))) {
    throw new ForumError("not_enrolled");
  }
  const parsed = NewPostInput.safeParse(rawInput);
  if (!parsed.success) throw new ForumError("validation_failed");

  const post = await db.forumPost.create({
    data: { threadId, authorId: userId, body: parsed.data.body },
  });
  await emitEvent(
    userId,
    LearningEventType.ForumPosted,
    { threadId, postId: post.id, lessonId: thread.lessonId, kind: "reply" },
    { courseId },
    db,
  );
  return { postId: post.id };
}

export async function markPostResolved(
  userId: string,
  threadId: string,
  postId: string,
  db: PrismaClient = prisma,
) {
  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      authorId: true,
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  if (!thread) throw new ForumError("thread_not_found");
  // Only the thread author can mark resolution.
  if (thread.authorId !== userId) throw new ForumError("forbidden");
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    select: { id: true, threadId: true },
  });
  if (!post || post.threadId !== threadId) throw new ForumError("post_not_found");
  await db.forumThread.update({
    where: { id: threadId },
    data: { resolvedPostId: postId },
  });
  await emitEvent(
    userId,
    LearningEventType.ForumAnswered,
    {
      threadId,
      postId,
    },
    { courseId: thread.lesson.module.courseId },
    db,
  );
}

export async function listThreadsForLesson(
  lessonId: string,
  db: PrismaClient = prisma,
) {
  return db.forumThread.findMany({
    where: { lessonId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { displayName: true } },
      _count: { select: { posts: true } },
    },
  });
}

export async function getThread(threadId: string, db: PrismaClient = prisma) {
  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    include: {
      author: { select: { id: true, displayName: true } },
      lesson: {
        select: {
          id: true,
          title: true,
          module: { select: { course: { select: { slug: true, title: true } } } },
        },
      },
      posts: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, displayName: true } } },
      },
    },
  });
  if (!thread) throw new ForumError("thread_not_found");
  return thread;
}
