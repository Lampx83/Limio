import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isUserEnrolled } from "./enroll";
import { LearningError } from "./lessons";

export const CreateNoteInput = z.object({
  body: z.string().trim().min(1).max(10_000),
  contentItemId: z.string().uuid().optional().nullable(),
  timestampSec: z.number().int().nonnegative().optional().nullable(),
});

export class NoteError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "lesson_not_found"
      | "not_enrolled"
      | "note_not_found",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

async function getCourseIdForLesson(
  lessonId: string,
  db: PrismaClient,
): Promise<string | null> {
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  return row?.module.courseId ?? null;
}

export async function createNote(
  userId: string,
  lessonId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ noteId: string }> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  if (!courseId) throw new NoteError("lesson_not_found");
  if (!(await isUserEnrolled(userId, courseId, db))) {
    throw new NoteError("not_enrolled");
  }
  const parsed = CreateNoteInput.safeParse(rawInput);
  if (!parsed.success) throw new NoteError("validation_failed", parsed.error.flatten());

  const note = await db.note.create({
    data: {
      userId,
      lessonId,
      contentItemId: parsed.data.contentItemId ?? null,
      timestampSec: parsed.data.timestampSec ?? null,
      body: parsed.data.body,
    },
  });
  return { noteId: note.id };
}

/** List the current user's notes for a lesson. Notes are private. */
export async function listLessonNotes(
  userId: string,
  lessonId: string,
  db: PrismaClient = prisma,
) {
  return db.note.findMany({
    where: { userId, lessonId },
    orderBy: [{ timestampSec: "asc" }, { createdAt: "asc" }],
  });
}

export async function deleteNote(
  userId: string,
  noteId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: { userId: true },
  });
  if (!note) throw new NoteError("note_not_found");
  // Privacy: a user can only delete their own notes.
  if (note.userId !== userId) throw new NoteError("note_not_found");
  await db.note.delete({ where: { id: noteId } });
}

// Re-export for convenience.
export { LearningError };
