import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "./authz";
import { attachLessonActivity } from "./lessonActivity";
import { isUserEnrolled } from "../learning/enroll";
import { emitEvent } from "../learning/events";
import { getUserTeamInCourse } from "../teams/teams";

export class AssignmentError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "lesson_not_found"
      | "assignment_not_found"
      | "submission_not_found"
      | "not_enrolled"
      | "no_team"
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
    .nullable()
    .optional()
    // null = bỏ hạn chung. Khi sửa (partial) undefined = không đụng tới, nên chỉ null mới xoá hạn.
    .transform((v) => (v == null ? null : new Date(v))),
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
  // Nộp theo nhóm (docs/group-submission-AC.md mục C).
  submissionMode: z.enum(["individual", "team"]).optional(),
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

const OverrideInput = z.object({
  // null = bỏ điểm riêng, về lại điểm nhóm.
  score: z.number().int().min(0).nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

const CONTRIBUTION_MAX_CHARS = 1_000;

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
        ...(parsed.data.submissionMode !== undefined && {
          submissionMode: parsed.data.submissionMode,
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
  if (parsed.data.submissionMode !== undefined) {
    const current = await db.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      select: { submissionMode: true, lessonId: true, _count: { select: { submissions: true } } },
    });
    if (current.submissionMode !== parsed.data.submissionMode) {
      // Bài tập gắn Tournament có cơ chế đội riêng — không dùng nhóm của khoá.
      if (!current.lessonId) throw new AssignmentError("validation_failed", "submission_mode_not_supported");
      // Đổi chế độ khi đã có bài nộp sẽ làm lệch dữ liệu (dòng cá nhân lẫn dòng nhóm).
      if (current._count.submissions > 0) throw new AssignmentError("validation_failed", "submission_mode_locked");
    }
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
      ...(parsed.data.submissionMode !== undefined && {
        submissionMode: parsed.data.submissionMode,
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
      submissionMode: true,
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

  if (a.submissionMode === "team" && a.lesson && courseId) {
    return submitTeamAssignment(db, {
      userId,
      assignmentId,
      courseId,
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      selfRating,
      reflection: reflectionTrimmed,
    });
  }

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
    teamId: null as string | null,
  };
}

/**
 * Nộp theo nhóm (AC C2–C5, C7): mỗi thành viên HIỆN TẠI của nhóm có một dòng
 * cùng nội dung, cùng `teamSubmittedAt`. Tự đánh giá/suy ngẫm chỉ gắn vào dòng
 * của người bấm nộp — đó là việc của riêng người đó, không chép cho cả nhóm.
 * Toàn bộ ghi + sự kiện trong một transaction (CLAUDE.md §5.1).
 */
async function submitTeamAssignment(
  db: PrismaClient,
  i: {
    userId: string;
    assignmentId: string;
    courseId: string;
    body: string;
    attachmentUrl: string | null;
    selfRating: number | null;
    reflection: string | null;
  },
) {
  return db.$transaction(
    async (tx) => {
      const team = await getUserTeamInCourse(i.userId, i.courseId, tx);
      if (!team) throw new AssignmentError("no_team");
      const teamSubmittedAt = new Date();
      let mySubmissionId = "";
      for (const memberId of team.memberIds) {
        const own = memberId === i.userId ? { selfRating: i.selfRating, reflection: i.reflection } : {};
        const shared = {
          body: i.body,
          attachmentUrl: i.attachmentUrl,
          teamId: team.teamId,
          submittedById: i.userId,
          teamSubmittedAt,
        };
        const row = await tx.assignmentSubmission.upsert({
          where: { assignmentId_userId: { assignmentId: i.assignmentId, userId: memberId } },
          create: { assignmentId: i.assignmentId, userId: memberId, ...shared, ...own },
          update: {
            ...shared,
            ...own,
            // Nộp lại = bài mới của cả nhóm: GV phải chấm lại, điểm chỉnh riêng cũng bỏ.
            status: "submitted",
            score: null,
            feedback: null,
            graderId: null,
            gradedAt: null,
            teamScore: null,
            scoreOverridden: false,
            scoreOverrideNote: null,
          },
          select: { id: true },
        });
        if (memberId === i.userId) mySubmissionId = row.id;
        await emitEvent(
          memberId,
          LearningEventType.AssignmentSubmitted,
          {
            assignmentId: i.assignmentId,
            submissionId: row.id,
            teamId: team.teamId,
            submittedById: i.userId,
            teamSubmission: true,
          },
          { courseId: i.courseId },
          tx,
        );
      }
      if (i.selfRating != null) {
        await emitEvent(
          i.userId,
          LearningEventType.AssignmentSelfRated,
          { assignmentId: i.assignmentId, submissionId: mySubmissionId, rating: i.selfRating },
          { courseId: i.courseId },
          tx,
        );
      }
      if (i.reflection) {
        await emitEvent(
          i.userId,
          LearningEventType.AssignmentReflected,
          { assignmentId: i.assignmentId, submissionId: mySubmissionId, length: i.reflection.length },
          { courseId: i.courseId },
          tx,
        );
      }
      return {
        submissionId: mySubmissionId,
        courseId: i.courseId as string | null,
        assignmentId: i.assignmentId,
        selfRating: i.selfRating,
        reflectionLength: i.reflection?.length ?? 0,
        teamId: team.teamId as string | null,
      };
    },
    { timeout: 15_000 },
  );
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
      teamId: true,
      teamSubmittedAt: true,
      assignment: {
        select: {
          id: true,
          maxScore: true,
          submissionMode: true,
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

  if (submission.assignment.submissionMode === "team" && submission.teamId && submission.teamSubmittedAt) {
    // Chấm nhóm (AC D2/D3): áp cho mọi dòng của CÙNG lần nộp; dòng có điểm
    // chỉnh riêng giữ điểm riêng, chỉ cập nhật teamScore + nhận xét.
    const teamId = submission.teamId;
    const teamSubmittedAt = submission.teamSubmittedAt;
    await db.$transaction(async (tx) => {
      const batch = await tx.assignmentSubmission.findMany({
        where: { assignmentId: submission.assignment.id, teamId, teamSubmittedAt },
        select: { id: true, userId: true, score: true, scoreOverridden: true },
      });
      const gradedAt = new Date();
      for (const r of batch) {
        const score = r.scoreOverridden && r.score != null ? r.score : parsed.data.score;
        await tx.assignmentSubmission.update({
          where: { id: r.id },
          data: {
            status: "graded",
            teamScore: parsed.data.score,
            score,
            feedback: parsed.data.feedback ?? null,
            graderId: userId,
            gradedAt,
          },
        });
        await emitEvent(
          r.userId,
          LearningEventType.AssignmentGraded,
          {
            assignmentId: submission.assignment.id,
            submissionId: r.id,
            score,
            teamScore: parsed.data.score,
            maxScore: submission.assignment.maxScore,
            graderId: userId,
            teamId,
          },
          { courseId },
          tx,
        );
      }
    });
    return;
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

// ─── Nộp theo nhóm: chỉnh điểm riêng, "Phần việc của tôi", danh sách chấm ────

/**
 * GV chỉnh điểm riêng một thành viên của bài nhóm (AC D3). Chỉ sau khi nhóm đã
 * được chấm; `score = null` bỏ điểm riêng, về lại điểm nhóm.
 */
export async function overrideSubmissionScore(
  userId: string,
  submissionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
) {
  const sub = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      teamId: true,
      status: true,
      teamScore: true,
      assignment: {
        select: { id: true, maxScore: true, lesson: { select: { module: { select: { courseId: true } } } } },
      },
    },
  });
  if (!sub) throw new AssignmentError("submission_not_found");
  const courseId = sub.assignment.lesson?.module.courseId;
  if (!courseId || !sub.teamId) throw new AssignmentError("validation_failed", "not_team_submission");
  await assertCanEditCourse(userId, courseId, db);

  const parsed = OverrideInput.safeParse(rawInput);
  if (!parsed.success) throw new AssignmentError("validation_failed", parsed.error.flatten());
  if (sub.status !== "graded" || sub.teamScore == null) {
    throw new AssignmentError("validation_failed", "grade_team_first");
  }
  if (parsed.data.score != null && parsed.data.score > sub.assignment.maxScore) {
    throw new AssignmentError("validation_failed", "score_exceeds_max");
  }
  const clearing = parsed.data.score == null;
  const score = clearing ? sub.teamScore : parsed.data.score!;
  await db.$transaction(async (tx) => {
    await tx.assignmentSubmission.update({
      where: { id: sub.id },
      data: {
        score,
        scoreOverridden: !clearing,
        scoreOverrideNote: clearing ? null : parsed.data.note?.trim() || null,
      },
    });
    await emitEvent(
      sub.userId,
      LearningEventType.AssignmentScoreOverridden,
      {
        assignmentId: sub.assignment.id,
        submissionId: sub.id,
        score: clearing ? null : score,
        teamScore: sub.teamScore,
        actorId: userId,
      },
      { courseId },
      tx,
    );
  });
}

/**
 * "Phần việc của tôi" (AC C6) — chỉ chủ dòng sửa, không đưa bài về chưa chấm.
 * Sự kiện chỉ mang độ dài, không mang chữ.
 */
export async function setSubmissionContributionNote(
  userId: string,
  submissionId: string,
  rawNote: string,
  db: PrismaClient = prisma,
) {
  const sub = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      teamId: true,
      assignment: { select: { id: true, lesson: { select: { module: { select: { courseId: true } } } } } },
    },
  });
  if (!sub) throw new AssignmentError("submission_not_found");
  if (sub.userId !== userId) throw new AssignmentError("forbidden");
  if (!sub.teamId) throw new AssignmentError("validation_failed", "not_team_submission");
  const note = (rawNote ?? "").trim();
  if (note.length > CONTRIBUTION_MAX_CHARS) throw new AssignmentError("validation_failed", "note_too_long");
  await db.$transaction(async (tx) => {
    await tx.assignmentSubmission.update({ where: { id: sub.id }, data: { contributionNote: note || null } });
    await emitEvent(
      userId,
      LearningEventType.AssignmentContributionNoted,
      { assignmentId: sub.assignment.id, submissionId: sub.id, length: note.length },
      { courseId: sub.assignment.lesson?.module.courseId ?? null },
      tx,
    );
  });
}

type MiniUser = { id: string; displayName: string; email: string };

export interface TeamSubmissionEntry {
  team: { id: string; name: string; captainId: string | null };
  currentMembers: MiniUser[];
  /** Lần nộp mới nhất của nhóm; null = nhóm chưa nộp. */
  latest: {
    /** Dòng đại diện để mở bài / chấm (ưu tiên dòng của thành viên hiện tại). */
    submissionId: string;
    teamSubmittedAt: Date;
    submittedBy: MiniUser | null;
    body: string;
    attachmentUrl: string | null;
    status: "submitted" | "graded";
    teamScore: number | null;
    feedback: string | null;
    gradedAt: Date | null;
    members: {
      submissionId: string;
      user: MiniUser;
      contributionNote: string | null;
      score: number | null;
      scoreOverridden: boolean;
      scoreOverrideNote: string | null;
      /** Đã rời nhóm sau lần nộp này. */
      leftTeam: boolean;
    }[];
  } | null;
  /** Vào nhóm sau lần nộp mới nhất — chưa có bài, lần nộp lại tới sẽ gồm họ. */
  joinedAfterSubmit: MiniUser[];
}

/** Danh sách chấm bài nhóm, mỗi nhóm một mục (AC D1). */
export async function listTeamSubmissionsForInstructor(
  userId: string,
  assignmentId: string,
  db: PrismaClient = prisma,
): Promise<{
  teams: TeamSubmissionEntry[];
  unassigned: MiniUser[];
  counts: { teams: number; submitted: number; graded: number };
}> {
  const scope = await loadAssignmentCourse(assignmentId, db);
  await assertCanGradeAssignment(userId, scope, db);
  const courseId = scope.courseId;
  if (!courseId) throw new AssignmentError("validation_failed", "not_team_submission");

  const userSel = { select: { id: true, displayName: true, email: true } } as const;
  const [teams, rows, enrollments] = await Promise.all([
    db.courseTeam.findMany({
      where: { courseId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        captainId: true,
        members: { orderBy: { joinedAt: "asc" }, select: { user: userSel } },
      },
    }),
    db.assignmentSubmission.findMany({
      where: { assignmentId, teamId: { not: null } },
      include: { user: userSel, submittedBy: userSel },
    }),
    db.enrollment.findMany({
      where: { courseId, status: { in: ["active", "completed"] } },
      select: { user: userSel },
    }),
  ]);

  const entries: TeamSubmissionEntry[] = teams
    .map((t) => {
      const current = t.members.map((m) => m.user);
      const currentIds = new Set(current.map((u) => u.id));
      const mine = rows.filter((r) => r.teamId === t.id && r.teamSubmittedAt);
      const latestAt = mine.reduce<number>((max, r) => Math.max(max, r.teamSubmittedAt!.getTime()), 0);
      const batch = mine.filter((r) => r.teamSubmittedAt!.getTime() === latestAt);
      if (batch.length === 0) {
        return { team: { id: t.id, name: t.name, captainId: t.captainId }, currentMembers: current, latest: null, joinedAfterSubmit: [] };
      }
      const rep = batch.find((r) => currentIds.has(r.userId)) ?? batch[0]!;
      const inBatch = new Set(batch.map((r) => r.userId));
      return {
        team: { id: t.id, name: t.name, captainId: t.captainId },
        currentMembers: current,
        latest: {
          submissionId: rep.id,
          teamSubmittedAt: rep.teamSubmittedAt!,
          submittedBy: rep.submittedBy,
          body: rep.body,
          attachmentUrl: rep.attachmentUrl,
          status: batch.every((r) => r.status === "graded") ? ("graded" as const) : ("submitted" as const),
          teamScore: rep.teamScore,
          feedback: rep.feedback,
          gradedAt: rep.gradedAt,
          members: batch
            .map((r) => ({
              submissionId: r.id,
              user: r.user,
              contributionNote: r.contributionNote,
              score: r.score,
              scoreOverridden: r.scoreOverridden,
              scoreOverrideNote: r.scoreOverrideNote,
              leftTeam: !currentIds.has(r.userId),
            }))
            .sort((a, b) => a.user.displayName.localeCompare(b.user.displayName, "vi")),
        },
        joinedAfterSubmit: current.filter((u) => !inBatch.has(u.id)),
      };
    })
    // Nhóm rỗng chưa từng nộp thì không có gì để chấm.
    .filter((e) => e.currentMembers.length > 0 || e.latest);

  const inTeam = new Set(teams.flatMap((t) => t.members.map((m) => m.user.id)));
  return {
    teams: entries,
    unassigned: enrollments
      .map((e) => e.user)
      .filter((u) => !inTeam.has(u.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi")),
    counts: {
      teams: entries.length,
      submitted: entries.filter((e) => e.latest).length,
      graded: entries.filter((e) => e.latest?.status === "graded").length,
    },
  };
}
