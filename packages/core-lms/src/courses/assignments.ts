import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "./authz";
import { isUserEnrolled } from "../learning/enroll";
import { emitEvent } from "../learning/events";

export class AssignmentError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "lesson_not_found"
      | "assignment_not_found"
      | "submission_not_found"
      | "not_enrolled"
      | "forbidden",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

const CreateInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  dueAt: z
    .union([z.string().datetime(), z.date()])
    .optional()
    .transform((v) => (v === undefined ? null : new Date(v))),
  maxScore: z.number().int().positive().max(1000).default(100),
  isHidden: z.boolean().optional(),
});

const UpdateInput = CreateInput.partial();

const SubmitInput = z.object({
  body: z.string().trim().min(1).max(50_000),
  attachmentUrl: z.string().url().max(500).optional().nullable(),
});

const GradeInput = z.object({
  score: z.number().int().min(0),
  feedback: z.string().trim().max(20_000).optional().nullable(),
});

async function loadLessonCourse(lessonId: string, db: PrismaClient) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) throw new AssignmentError("lesson_not_found");
  return lesson.module.courseId;
}

async function loadAssignmentCourse(assignmentId: string, db: PrismaClient) {
  const a = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      maxScore: true,
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  if (!a) throw new AssignmentError("assignment_not_found");
  return { courseId: a.lesson.module.courseId, maxScore: a.maxScore };
}

export async function createAssignment(
  userId: string,
  lessonId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const courseId = await loadLessonCourse(lessonId, db);
  await assertCanEditCourse(userId, courseId, db);

  const parsed = CreateInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new AssignmentError("validation_failed", parsed.error.flatten());
  }
  const created = await db.assignment.create({
    data: {
      lessonId,
      title: parsed.data.title,
      description: parsed.data.description,
      dueAt: parsed.data.dueAt,
      maxScore: parsed.data.maxScore,
    },
  });
  return { assignmentId: created.id };
}

export async function updateAssignment(
  userId: string,
  assignmentId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const { courseId } = await loadAssignmentCourse(assignmentId, db);
  await assertCanEditCourse(userId, courseId, db);

  const parsed = UpdateInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new AssignmentError("validation_failed", parsed.error.flatten());
  }
  await db.assignment.update({
    where: { id: assignmentId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.dueAt !== undefined && { dueAt: parsed.data.dueAt }),
      ...(parsed.data.maxScore !== undefined && { maxScore: parsed.data.maxScore }),
      ...(parsed.data.isHidden !== undefined && { isHidden: parsed.data.isHidden }),
    },
  });
}

export async function deleteAssignment(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
) {
  const { courseId } = await loadAssignmentCourse(assignmentId, db);
  await assertCanEditCourse(userId, courseId, db);
  await db.assignment.delete({ where: { id: assignmentId } });
}

/** Learner submits or re-submits. Idempotent on (assignmentId, userId). */
export async function submitAssignment(
  userId: string,
  assignmentId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const { courseId } = await loadAssignmentCourse(assignmentId, db);
  if (!(await isUserEnrolled(userId, courseId, db))) {
    throw new AssignmentError("not_enrolled");
  }
  const parsed = SubmitInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new AssignmentError("validation_failed", parsed.error.flatten());
  }
  const submission = await db.assignmentSubmission.upsert({
    where: { assignmentId_userId: { assignmentId, userId } },
    create: {
      assignmentId,
      userId,
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    },
    update: {
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      // Re-submission resets to "submitted" — instructor must re-grade.
      status: "submitted",
      score: null,
      feedback: null,
      graderId: null,
      gradedAt: null,
    },
  });
  await emitEvent(
    userId,
    LearningEventType.AssignmentSubmitted,
    {
      assignmentId,
      submissionId: submission.id,
    },
    { courseId },
    db,
  );
  return { submissionId: submission.id };
}

export async function gradeSubmission(
  userId: string,
  submissionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const submission = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      assignment: {
        select: { id: true, maxScore: true, lesson: { select: { module: { select: { courseId: true } } } } },
      },
    },
  });
  if (!submission) throw new AssignmentError("submission_not_found");
  const courseId = submission.assignment.lesson.module.courseId;
  await assertCanEditCourse(userId, courseId, db);

  const parsed = GradeInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new AssignmentError("validation_failed", parsed.error.flatten());
  }
  if (parsed.data.score > submission.assignment.maxScore) {
    throw new AssignmentError("validation_failed", "score_exceeds_max");
  }

  await db.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      status: "graded",
      score: parsed.data.score,
      feedback: parsed.data.feedback ?? null,
      graderId: userId,
      gradedAt: new Date(),
    },
  });
  await emitEvent(
    submission.userId,
    LearningEventType.AssignmentGraded,
    {
      assignmentId: submission.assignment.id,
      submissionId,
      score: parsed.data.score,
      maxScore: submission.assignment.maxScore,
      graderId: userId,
    },
    { courseId },
    db,
  );
}

export async function listAssignmentsForLesson(
  lessonId: string,
  db: PrismaClient = prisma,
) {
  return db.assignment.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      dueAt: true,
      maxScore: true,
      createdAt: true,
    },
  });
}

export async function getAssignmentForLearner(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
) {
  const { courseId } = await loadAssignmentCourse(assignmentId, db);
  if (!(await isUserEnrolled(userId, courseId, db))) {
    throw new AssignmentError("not_enrolled");
  }
  const a = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: {
      id: true,
      title: true,
      description: true,
      dueAt: true,
      maxScore: true,
      lessonId: true,
    },
  });
  const submission = await db.assignmentSubmission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } },
  });
  return { assignment: a, submission };
}

export async function listSubmissionsForInstructor(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
) {
  const { courseId } = await loadAssignmentCourse(assignmentId, db);
  await assertCanEditCourse(userId, courseId, db);
  return db.assignmentSubmission.findMany({
    where: { assignmentId },
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
  });
}
