import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { QuizError } from "./types";

const OptionInput = z.object({
  label: z.string().min(1).max(2_000).trim(),
  isCorrect: z.boolean(),
  misconceptionId: z.string().uuid().optional().nullable(),
  // Per-option metadata: matching pairs use { side, pairKey }.
  extra: z.record(z.unknown()).optional().nullable(),
});

const ALL_TYPES = [
  "mcq",
  "true_false",
  "fill_in",
  "ordering",
  "matching",
  "numerical",
  "essay",
  "short_answer",
] as const;

export const CreateQuestionInput = z
  .object({
    type: z.enum(ALL_TYPES),
    prompt: z.string().min(1).max(5_000).trim(),
    explanation: z.string().max(5_000).optional(),
    points: z.number().int().min(1).max(100).optional(),
    orderIndex: z.number().int().nonnegative(),
    // Optional for essay (no options needed). Required for everything else.
    options: z.array(OptionInput).max(40).optional(),
    skillIds: z.array(z.string().uuid()).max(20).optional(),
    // Type-specific question metadata: numerical { expected, tolerance },
    // short_answer { acceptedRegexes }, etc.
    extra: z.record(z.unknown()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const opts = data.options ?? [];
    const correctCount = opts.filter((o) => o.isCorrect).length;

    if (data.type === "essay") {
      // No options required.
      return;
    }

    // numerical: needs `extra.expected`, no options needed.
    if (data.type === "numerical") {
      const exp = (data.extra ?? {}) as { expected?: unknown };
      if (typeof exp.expected !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "numerical: extra.expected (number) required",
          path: ["extra", "expected"],
        });
      }
      return;
    }

    if (opts.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "options required for this type",
        path: ["options"],
      });
      return;
    }

    if (
      (data.type === "mcq" ||
        data.type === "true_false" ||
        data.type === "fill_in" ||
        data.type === "short_answer") &&
      correctCount === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "at least one option must be isCorrect",
        path: ["options"],
      });
    }
    if (data.type === "true_false" && opts.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "true_false must have exactly 2 options",
        path: ["options"],
      });
    }
    if (data.type === "true_false" && correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "true_false must have exactly 1 correct option",
        path: ["options"],
      });
    }
    if (data.type === "ordering" && opts.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ordering needs at least 2 options",
        path: ["options"],
      });
    }
    if (data.type === "matching") {
      // Validate every option has { side: 'left'|'right', pairKey: string } and
      // every pairKey appears exactly once on each side.
      const pairs: Record<string, { left: number; right: number }> = {};
      for (const o of opts) {
        const meta = (o.extra ?? {}) as { side?: string; pairKey?: string };
        if (
          (meta.side !== "left" && meta.side !== "right") ||
          typeof meta.pairKey !== "string" ||
          meta.pairKey.length === 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "matching options need extra={side,pairKey}",
            path: ["options"],
          });
          return;
        }
        const entry = pairs[meta.pairKey] ?? { left: 0, right: 0 };
        entry[meta.side as "left" | "right"] += 1;
        pairs[meta.pairKey] = entry;
      }
      for (const [k, c] of Object.entries(pairs)) {
        if (c.left !== 1 || c.right !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `matching pairKey "${k}" must appear once on left + once on right`,
            path: ["options"],
          });
        }
      }
    }
  });

export const UpdateQuestionInput = z.object({
  prompt: z.string().min(1).max(5_000).trim().optional(),
  explanation: z.string().max(5_000).optional().nullable(),
  points: z.number().int().min(1).max(100).optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  /**
   * Full replacement of all options. If omitted, existing options are left
   * untouched. Validated with the same rules as CreateQuestionInput (caller
   * must also supply the question `type` for cross-field validation).
   */
  options: z.array(OptionInput).max(40).optional(),
  /** Replaces all skill tags when provided (supply [] to clear). */
  skillIds: z.array(z.string().uuid()).max(20).optional(),
  /** Type-specific metadata replacement (numerical expected/tolerance, etc.) */
  extra: z.record(z.unknown()).optional().nullable(),
});

async function getCourseIdForQuiz(quizId: string, db: PrismaClient): Promise<string | null> {
  const q = await db.quiz.findUnique({ where: { id: quizId }, select: { courseId: true } });
  return q?.courseId ?? null;
}

async function getCourseIdForQuestion(
  questionId: string,
  db: PrismaClient,
): Promise<string | null> {
  const q = await db.quizQuestion.findUnique({
    where: { id: questionId },
    select: { quiz: { select: { courseId: true } } },
  });
  return q?.quiz.courseId ?? null;
}

/**
 * Dual auth for quiz operations.
 * - Course-linked quiz → standard `assertCanEditCourse` path.
 * - Tournament-backed quiz (courseId null, tournamentMissionId set) → only the
 *   tournament creator can edit. Admins always pass via `assertCanEditCourse`
 *   on a real courseId, so we don't re-check them here.
 *
 * Returns the courseId used for downstream operations ("" for cross-course
 * tournaments — callers that need a real courseId must guard on it).
 */
async function assertQuizEditAuth(
  actorUserId: string,
  quizId: string,
  db: PrismaClient,
): Promise<string> {
  const q = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      courseId: true,
      tournamentMission: {
        select: { tournament: { select: { courseId: true, creatorId: true } } },
      },
    },
  });
  if (!q) throw new QuizError("quiz_not_found");

  if (q.courseId) {
    await assertCanEditCourse(actorUserId, q.courseId, db);
    return q.courseId;
  }
  if (q.tournamentMission) {
    const t = q.tournamentMission.tournament;
    if (t.courseId) {
      await assertCanEditCourse(actorUserId, t.courseId, db);
      return t.courseId;
    }
    // Cross-course tournament: only creator can edit.
    if (t.creatorId !== actorUserId) {
      throw new QuizError("forbidden");
    }
    return "";
  }
  throw new QuizError("quiz_not_found");
}

export async function createQuestion(
  actorUserId: string,
  quizId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ questionId: string }> {
  // Dual auth: course-linked OR tournament-backed quiz.
  await assertQuizEditAuth(actorUserId, quizId, db);

  const parsed = CreateQuestionInput.safeParse(rawInput);
  if (!parsed.success) throw new QuizError("validation_failed", parsed.error.flatten());
  const input = parsed.data;

  return db.$transaction(async (tx) => {
    const q = await tx.quizQuestion.create({
      data: {
        quizId,
        type: input.type,
        prompt: input.prompt,
        explanation: input.explanation ?? null,
        points: input.points ?? 1,
        orderIndex: input.orderIndex,
        extra: input.extra
          ? (input.extra as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        options: {
          create: (input.options ?? []).map((o, i) => ({
            label: o.label,
            isCorrect: o.isCorrect,
            misconceptionId: o.misconceptionId ?? null,
            orderIndex: i,
            extra: o.extra
              ? (o.extra as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          })),
        },
      },
    });
    if (input.skillIds?.length) {
      await tx.questionSkillTag.createMany({
        data: input.skillIds.map((skillId) => ({ questionId: q.id, skillId })),
        skipDuplicates: true,
      });
    }
    return { questionId: q.id };
  });
}

async function assertQuestionEditAuth(
  actorUserId: string,
  questionId: string,
  db: PrismaClient,
): Promise<void> {
  const q = await db.quizQuestion.findUnique({
    where: { id: questionId },
    select: { quizId: true },
  });
  if (!q) throw new QuizError("question_not_found");
  await assertQuizEditAuth(actorUserId, q.quizId, db);
}

export async function updateQuestion(
  actorUserId: string,
  questionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertQuestionEditAuth(actorUserId, questionId, db);
  const parsed = UpdateQuestionInput.safeParse(rawInput);
  if (!parsed.success) throw new QuizError("validation_failed", parsed.error.flatten());
  const { options, skillIds, extra, ...scalarFields } = parsed.data;

  // Build scalar update (prompt, points, explanation, orderIndex, extra).
  const scalarData = Object.fromEntries(
    Object.entries({ ...scalarFields, extra }).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;

  // Normalise extra: null → Prisma.JsonNull so Prisma doesn't skip the field.
  if ("extra" in scalarData) {
    scalarData.extra =
      scalarData.extra === null ? Prisma.JsonNull : (scalarData.extra as Prisma.InputJsonValue);
  }

  const needsScalarUpdate = Object.keys(scalarData).length > 0;
  const needsOptionsUpdate = options !== undefined;
  const needsSkillsUpdate = skillIds !== undefined;

  if (!needsScalarUpdate && !needsOptionsUpdate && !needsSkillsUpdate) return;

  await db.$transaction(async (tx) => {
    if (needsScalarUpdate) {
      await tx.quizQuestion.update({ where: { id: questionId }, data: scalarData });
    }

    if (needsOptionsUpdate) {
      // Replace all options atomically.
      await tx.questionOption.deleteMany({ where: { questionId } });
      if (options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((o, i) => ({
            questionId,
            label: o.label,
            isCorrect: o.isCorrect,
            misconceptionId: o.misconceptionId ?? null,
            orderIndex: i,
            extra: o.extra ? (o.extra as Prisma.InputJsonValue) : Prisma.JsonNull,
          })),
        });
      }
    }

    if (needsSkillsUpdate) {
      // Replace all skill tags atomically.
      await tx.questionSkillTag.deleteMany({ where: { questionId } });
      if (skillIds.length > 0) {
        await tx.questionSkillTag.createMany({
          data: skillIds.map((skillId) => ({ questionId, skillId })),
          skipDuplicates: true,
        });
      }
    }
  });
}

export async function deleteQuestion(
  actorUserId: string,
  questionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertQuestionEditAuth(actorUserId, questionId, db);
  await db.quizQuestion.delete({ where: { id: questionId } });
}

/** Tag a question with one skill. Idempotent. */
export async function tagQuestionSkill(
  actorUserId: string,
  questionId: string,
  skillId: string,
  db: PrismaClient = prisma,
): Promise<{ created: boolean }> {
  await assertQuestionEditAuth(actorUserId, questionId, db);
  const skill = await db.skill.findUnique({ where: { id: skillId }, select: { id: true } });
  if (!skill) throw new QuizError("validation_failed", "skill_not_found");
  const existing = await db.questionSkillTag.findUnique({
    where: { questionId_skillId: { questionId, skillId } },
  });
  if (existing) return { created: false };
  await db.questionSkillTag.create({ data: { questionId, skillId } });
  return { created: true };
}

export async function untagQuestionSkill(
  actorUserId: string,
  questionId: string,
  skillId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertQuestionEditAuth(actorUserId, questionId, db);
  await db.questionSkillTag.deleteMany({ where: { questionId, skillId } });
}
