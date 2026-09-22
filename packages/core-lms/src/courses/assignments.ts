import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "./authz";
import { attachLessonActivity } from "./lessonActivity";
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

const GenerativeActivityTypeSchema = z.enum([
  "summarizing",
  "mapping",
  "drawing",
  "imagining",
  "self_explaining",
  "teaching",
  "enacting",
]);

const AssessmentModeSchema = z.enum([
  "instructor_graded",
  "self_assessed",
  "ai_assessed",
  "peer_reviewed",
]);

const ResponseFormatSchema = z.enum([
  "text",
  "file",
  "image",
  "audio",
  "video",
  "concept_map",
  "mixed",
]);

const CreateInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  dueAt: z
    .union([z.string().datetime(), z.date()])
    .optional()
    .transform((v) => (v === undefined ? null : new Date(v))),
  maxScore: z.number().int().positive().max(1000).default(100),
  isHidden: z.boolean().optional(),
  pedagogicalIntent: GenerativeActivityTypeSchema.nullable().optional(),
  responseFormat: ResponseFormatSchema.optional(),
  assessmentModes: z.array(AssessmentModeSchema).min(1).optional(),
  requireSelfRating: z.boolean().optional(),
  requireReflection: z.boolean().optional(),
  countsTowardGrade: z.boolean().optional(),
  // Ngữ cảnh cho "Gợi ý điểm bằng AI" trên từng bài nộp — không bắt buộc.
  rubricText: z.string().trim().max(5_000).nullable().optional(),
});

const UpdateInput = CreateInput.partial();

const REFLECTION_MIN_CHARS = 20;

const SubmitInput = z.object({
  body: z.string().trim().min(1).max(50_000),
  attachmentUrl: z.string().url().max(500).optional().nullable(),
  selfRating: z.number().int().min(1).max(5).optional().nullable(),
  reflection: z.string().trim().max(20_000).optional().nullable(),
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
      tournamentMission: {
        select: {
          tournament: { select: { courseId: true, creatorId: true } },
        },
      },
    },
  });
  if (!a) throw new AssignmentError("assignment_not_found");
  // Lesson-backed → courseId from module. Tournament-backed → courseId from
  // tournament (null if cross-course tournament). Throw only if neither.
  const courseId =
    a.lesson?.module.courseId ?? a.tournamentMission?.tournament.courseId ?? null;
  const tournamentCreatorId =
    a.lesson ? null : a.tournamentMission?.tournament.creatorId ?? null;
  if (!courseId && !tournamentCreatorId) {
    throw new AssignmentError("assignment_not_found");
  }
  return { courseId, maxScore: a.maxScore, tournamentCreatorId };
}

async function assertCanGradeAssignment(
  userId: string,
  scope: { courseId: string | null; tournamentCreatorId: string | null },
  db: PrismaClient,
) {
  if (scope.courseId) {
    await assertCanEditCourse(userId, scope.courseId, db);
    return;
  }
  if (scope.tournamentCreatorId && scope.tournamentCreatorId !== userId) {
    throw new AssignmentError("forbidden");
  }
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
  // Wrap entity create + LessonActivity attach in one transaction so the
  // ordering layer stays consistent with the entity table.
  const createdId = await db.$transaction(async (tx) => {
    const created = await tx.assignment.create({
      data: {
        lessonId,
        title: parsed.data.title,
        description: parsed.data.description,
        dueAt: parsed.data.dueAt,
        maxScore: parsed.data.maxScore,
        ...(parsed.data.pedagogicalIntent !== undefined && {
          pedagogicalIntent: parsed.data.pedagogicalIntent,
        }),
        ...(parsed.data.responseFormat !== undefined && {
          responseFormat: parsed.data.responseFormat,
        }),
        ...(parsed.data.assessmentModes !== undefined && {
          assessmentModes: parsed.data.assessmentModes,
        }),
        ...(parsed.data.requireSelfRating !== undefined && {
          requireSelfRating: parsed.data.requireSelfRating,
        }),
        ...(parsed.data.requireReflection !== undefined && {
          requireReflection: parsed.data.requireReflection,
        }),
        ...(parsed.data.countsTowardGrade !== undefined && {
          countsTowardGrade: parsed.data.countsTowardGrade,
        }),
        ...(parsed.data.rubricText !== undefined && {
          rubricText: parsed.data.rubricText,
        }),
      },
    });
    await attachLessonActivity(tx, lessonId, "assignment", created.id);
    return created.id;
  });
  return { assignmentId: createdId };
}

export async function updateAssignment(
  userId: string,
  assignmentId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const scope = await loadAssignmentCourse(assignmentId, db);
  await assertCanGradeAssignment(userId, scope, db);

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
      ...(parsed.data.pedagogicalIntent !== undefined && {
        pedagogicalIntent: parsed.data.pedagogicalIntent,
      }),
      ...(parsed.data.responseFormat !== undefined && {
        responseFormat: parsed.data.responseFormat,
      }),
      ...(parsed.data.assessmentModes !== undefined && {
        assessmentModes: parsed.data.assessmentModes,
      }),
      ...(parsed.data.requireSelfRating !== undefined && {
        requireSelfRating: parsed.data.requireSelfRating,
      }),
      ...(parsed.data.requireReflection !== undefined && {
        requireReflection: parsed.data.requireReflection,
      }),
      ...(parsed.data.countsTowardGrade !== undefined && {
        countsTowardGrade: parsed.data.countsTowardGrade,
      }),
      ...(parsed.data.rubricText !== undefined && {
        rubricText: parsed.data.rubricText,
      }),
    },
  });
}

export async function deleteAssignment(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
) {
  const scope = await loadAssignmentCourse(assignmentId, db);
  await assertCanGradeAssignment(userId, scope, db);
  await db.assignment.delete({ where: { id: assignmentId } });
}

/** Learner submits or re-submits. Idempotent on (assignmentId, userId). */
export async function submitAssignment(
  userId: string,
  assignmentId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const a = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      requireSelfRating: true,
      requireReflection: true,
      lesson: { select: { module: { select: { courseId: true } } } },
      // Tournament MANUAL_REVIEW mission backing (lessonId null trong trường hợp này).
      tournamentMission: {
        select: { tournamentId: true, tournament: { select: { courseId: true } } },
      },
    },
  });
  if (!a) throw new AssignmentError("assignment_not_found");

  // courseId: null hợp lệ với tournament "toàn nền tảng" (không gắn course).
  let courseId: string | null;
  if (a.lesson) {
    // Lesson-backed: yêu cầu enroll khoá học.
    courseId = a.lesson.module.courseId;
    if (!(await isUserEnrolled(userId, courseId, db))) {
      throw new AssignmentError("not_enrolled");
    }
  } else if (a.tournamentMission) {
    // Tournament-backed: yêu cầu là người chơi đã đăng ký (chưa bị loại).
    courseId = a.tournamentMission.tournament.courseId;
    const reg = await db.tournamentRegistration.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: a.tournamentMission.tournamentId,
          userId,
        },
      },
      select: { disqualifiedAt: true },
    });
    if (!reg || reg.disqualifiedAt) {
      throw new AssignmentError("not_enrolled");
    }
  } else {
    throw new AssignmentError("assignment_not_found");
  }
  const parsed = SubmitInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new AssignmentError("validation_failed", parsed.error.flatten());
  }
  const reflectionTrimmed = parsed.data.reflection?.trim() ?? null;
  const selfRating = parsed.data.selfRating ?? null;

  if (a.requireSelfRating && selfRating == null) {
    throw new AssignmentError("validation_failed", "self_rating_required");
  }
  if (
    a.requireReflection &&
    (!reflectionTrimmed || reflectionTrimmed.length < REFLECTION_MIN_CHARS)
  ) {
    throw new AssignmentError("validation_failed", "reflection_required");
  }
  // Anti-farming: rating without any submission body is rejected up-front
  // by SubmitInput.body.min(1); reflection-only with empty body would also
  // fail there. Rating outside 1..5 caught by zod.

  const submission = await db.assignmentSubmission.upsert({
    where: { assignmentId_userId: { assignmentId, userId } },
    create: {
      assignmentId,
      userId,
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      selfRating,
      reflection: reflectionTrimmed,
    },
    update: {
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      selfRating,
      reflection: reflectionTrimmed,
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
  if (selfRating != null) {
    await emitEvent(
      userId,
      LearningEventType.AssignmentSelfRated,
      { assignmentId, submissionId: submission.id, rating: selfRating },
      { courseId },
      db,
    );
  }
  if (reflectionTrimmed) {
    await emitEvent(
      userId,
      LearningEventType.AssignmentReflected,
      {
        assignmentId,
        submissionId: submission.id,
        length: reflectionTrimmed.length,
      },
      { courseId },
      db,
    );
  }
  return {
    submissionId: submission.id,
    courseId,
    assignmentId,
    selfRating,
    reflectionLength: reflectionTrimmed?.length ?? 0,
  };
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
        select: {
          id: true,
          maxScore: true,
          lesson: { select: { module: { select: { courseId: true } } } },
          tournamentMission: { select: { tournament: { select: { courseId: true, creatorId: true } } } },
        },
      },
    },
  });
  if (!submission) throw new AssignmentError("submission_not_found");
  // Tournament-backed assignments may have no lesson — derive courseId from
  // tournament, fallback to empty string for cross-course tournaments. Auth
  // is delegated to tournament creator + admins in that case.
  const courseId =
    submission.assignment.lesson?.module.courseId ??
    submission.assignment.tournamentMission?.tournament.courseId ??
    "";
  if (courseId) {
    await assertCanEditCourse(userId, courseId, db);
  } else {
    // Cross-course tournament: only the tournament creator (or admin) can grade.
    const creatorId = submission.assignment.tournamentMission?.tournament.creatorId;
    if (creatorId && creatorId !== userId) {
      // Admin check is handled by assertCanEditCourse's path; for cross-course
      // we trust the tournament boundary — instructor of tournament only.
      throw new AssignmentError("forbidden");
    }
  }

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

export interface SubmissionGradingContext {
  assignmentTitle: string;
  assignmentDescription: string;
  maxScore: number;
  rubricText: string | null;
  submissionBody: string;
}

/**
 * Ngữ cảnh cho "Gợi ý điểm bằng AI" — CÙNG luật quyền như gradeSubmission
 * (courseId qua lesson, hoặc chủ tournament cho assignment cross-course),
 * cố ý lặp lại khối authz thay vì trừu tượng hoá chung với gradeSubmission:
 * hai hàm đọc field khác nhau (grade cần userId để emit event, cái này thì
 * không), gộp chung sẽ phải truyền cờ để phân nhánh — không đáng.
 */
export async function getSubmissionGradingContext(
  userId: string,
  submissionId: string,
  db: PrismaClient = prisma,
): Promise<SubmissionGradingContext> {
  const submission = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      body: true,
      assignment: {
        select: {
          title: true,
          description: true,
          maxScore: true,
          rubricText: true,
          lesson: { select: { module: { select: { courseId: true } } } },
          tournamentMission: { select: { tournament: { select: { courseId: true, creatorId: true } } } },
        },
      },
    },
  });
  if (!submission) throw new AssignmentError("submission_not_found");
  const courseId =
    submission.assignment.lesson?.module.courseId ??
    submission.assignment.tournamentMission?.tournament.courseId ??
    "";
  if (courseId) {
    await assertCanEditCourse(userId, courseId, db);
  } else {
    const creatorId = submission.assignment.tournamentMission?.tournament.creatorId;
    if (creatorId && creatorId !== userId) {
      throw new AssignmentError("forbidden");
    }
  }
  return {
    assignmentTitle: submission.assignment.title,
    assignmentDescription: submission.assignment.description,
    maxScore: submission.assignment.maxScore,
    rubricText: submission.assignment.rubricText,
    submissionBody: submission.body,
  };
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
      pedagogicalIntent: true,
      responseFormat: true,
      assessmentModes: true,
      requireSelfRating: true,
      requireReflection: true,
      countsTowardGrade: true,
      rubricText: true,
    },
  });
}

const assignmentForLearnerSelect = {
  id: true,
  title: true,
  description: true,
  dueAt: true,
  maxScore: true,
  lessonId: true,
  pedagogicalIntent: true,
  responseFormat: true,
  assessmentModes: true,
  requireSelfRating: true,
  requireReflection: true,
  countsTowardGrade: true,
} satisfies Prisma.AssignmentSelect;

export async function getAssignmentForLearner(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
): Promise<{
  assignment: Prisma.AssignmentGetPayload<{
    select: typeof assignmentForLearnerSelect;
  }>;
  submission: Prisma.AssignmentSubmissionGetPayload<true> | null;
}> {
  const { courseId } = await loadAssignmentCourse(assignmentId, db);
  if (!courseId) throw new AssignmentError("assignment_not_found");
  if (!(await isUserEnrolled(userId, courseId, db))) {
    throw new AssignmentError("not_enrolled");
  }
  const a = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: assignmentForLearnerSelect,
  });
  const submission = await db.assignmentSubmission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } },
  });
  return { assignment: a, submission };
}

const submissionForInstructorInclude = {
  user: { select: { id: true, displayName: true, email: true } },
} satisfies Prisma.AssignmentSubmissionInclude;

export type InstructorSubmissionRow = {
  user: { id: string; displayName: string; email: string };
  enrolledAt: Date | null;
  section: { id: string; name: string } | null;
  submission: Prisma.AssignmentSubmissionGetPayload<{
    include: typeof submissionForInstructorInclude;
  }> | null;
};

/**
 * Roster đầy đủ theo danh sách đăng ký khoá học (kể cả học viên chưa nộp bài),
 * không chỉ những ai đã có row AssignmentSubmission. Với assignment gắn
 * tournament mission platform-wide (không có courseId) thì không có roster để
 * đối chiếu — chỉ liệt kê ai đã nộp, như trước.
 */
export async function listSubmissionsForInstructor(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
): Promise<InstructorSubmissionRow[]> {
  const scope = await loadAssignmentCourse(assignmentId, db);
  await assertCanGradeAssignment(userId, scope, db);

  const submissions = await db.assignmentSubmission.findMany({
    where: { assignmentId },
    include: submissionForInstructorInclude,
  });

  if (!scope.courseId) {
    return submissions
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
      .map((s) => ({ user: s.user, enrolledAt: null, section: null, submission: s }));
  }

  const enrollments = await db.enrollment.findMany({
    where: { courseId: scope.courseId, status: { in: ["active", "completed"] } },
    select: {
      enrolledAt: true,
      user: { select: { id: true, displayName: true, email: true } },
      section: { select: { id: true, name: true } },
    },
  });

  const submissionByUserId = new Map(submissions.map((s) => [s.userId, s]));

  return enrollments
    .map((e) => ({
      user: e.user,
      enrolledAt: e.enrolledAt,
      section: e.section,
      submission: submissionByUserId.get(e.user.id) ?? null,
    }))
    .sort((a, b) => a.user.displayName.localeCompare(b.user.displayName, "vi"));
}
