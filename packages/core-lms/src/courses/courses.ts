import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { logAudit } from "../auth/audit";
import { uniqueCourseSlug } from "./slug";
import { assertCanEditCourse, CourseAuthzError } from "./authz";

export const CreateCourseInput = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(20_000).trim(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
    .optional(),
  language: z.string().min(2).max(10).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  category: z.string().max(80).optional(),
  coverUrl: z.string().url().max(500).optional(),
});

export const UpdateCourseInput = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().min(1).max(20_000).trim().optional(),
  language: z.string().min(2).max(10).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  category: z.string().max(80).optional().nullable(),
  coverUrl: z.string().url().max(500).optional().nullable(),
});

export class CourseError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "not_found"
      | "lessons_missing_skills"
      | "invalid_status_transition",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

/**
 * Create a course owned by `actorUserId`.
 * Side effects:
 *   - CourseInstructor row (role=owner)
 *   - If actor not yet platform-instructor, auto-grant instructor role + audit
 *   - Audit log "course.created"
 */
export async function createCourse(
  actorUserId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ courseId: string; slug: string }> {
  const parsed = CreateCourseInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());

  const slug = await uniqueCourseSlug(parsed.data.slug ?? parsed.data.title, db);
  const instructorRole = await db.role.findUniqueOrThrow({ where: { name: RoleName.Instructor } });

  return db.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        slug,
        title: parsed.data.title,
        description: parsed.data.description,
        language: parsed.data.language ?? "vi",
        level: parsed.data.level ?? "beginner",
        category: parsed.data.category ?? null,
        coverUrl: parsed.data.coverUrl ?? null,
        status: "draft",
        version: 1,
      },
    });
    await tx.courseInstructor.create({
      data: { courseId: course.id, userId: actorUserId, role: "owner" },
    });

    // Auto-grant platform-wide instructor role if absent.
    const hasInstructor = await tx.userRole.findFirst({
      where: { userId: actorUserId, roleId: instructorRole.id, courseId: null },
    });
    if (!hasInstructor) {
      const ur = await tx.userRole.create({
        data: { userId: actorUserId, roleId: instructorRole.id, grantedBy: actorUserId },
      });
      await logAudit(
        {
          action: "role.granted",
          actorUserId,
          targetUserId: actorUserId,
          payload: {
            roleName: RoleName.Instructor,
            courseId: null,
            userRoleId: ur.id,
            reason: "auto_on_course_create",
          },
        },
        tx,
      );
    }

    await logAudit(
      {
        action: "course.created",
        actorUserId,
        payload: { courseId: course.id, slug: course.slug, title: course.title },
      },
      tx,
    );

    return { courseId: course.id, slug: course.slug };
  });
}

export async function updateCourse(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = UpdateCourseInput.safeParse(rawInput);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());
  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(data).length === 0) return;
  await db.course.update({ where: { id: courseId }, data });
}

export async function archiveCourse(
  actorUserId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  if (course.status === "archived") return;
  await db.course.update({
    where: { id: courseId },
    data: { status: "archived" },
  });
  await logAudit(
    { action: "course.archived", actorUserId, payload: { courseId } },
    db,
  );
}

export async function bumpCourseVersion(
  actorUserId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<{ version: number }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const updated = await db.course.update({
    where: { id: courseId },
    data: { version: { increment: 1 } },
  });
  await logAudit(
    {
      action: "course.version.bumped",
      actorUserId,
      payload: { courseId, newVersion: updated.version },
    },
    db,
  );
  return { version: updated.version };
}

/** Publish gate: every lesson must have ≥1 skill tag. */
export async function publishCourse(
  actorUserId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  if (course.status === "archived") {
    throw new CourseError("invalid_status_transition", "cannot publish archived course");
  }

  // Find lessons under this course that have zero skill tags.
  const untagged = await db.$queryRaw<Array<{ id: string; title: string }>>`
    SELECT l.id, l.title
    FROM "Lesson" l
    JOIN "Module" m ON m.id = l."moduleId"
    LEFT JOIN "ContentSkillMapping" csm
      ON csm."contentId" = l.id AND csm."contentType" = 'lesson'
    WHERE m."courseId" = ${courseId}
    GROUP BY l.id, l.title
    HAVING COUNT(csm.id) = 0
  `;
  if (untagged.length > 0) {
    throw new CourseError("lessons_missing_skills", { lessons: untagged });
  }

  await db.course.update({
    where: { id: courseId },
    data: { status: "published", publishedAt: new Date() },
  });
  await logAudit(
    { action: "course.published", actorUserId, payload: { courseId } },
    db,
  );
}

export interface CatalogQuery {
  category?: string;
  level?: string;
  language?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

const CatalogQuerySchema = z.object({
  category: z.string().max(80).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  language: z.string().min(2).max(10).optional(),
  q: z.string().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** Public catalog — only published courses. */
export async function listPublishedCourses(
  rawQuery: unknown,
  db: PrismaClient = prisma,
) {
  const parsed = CatalogQuerySchema.safeParse(rawQuery);
  if (!parsed.success) throw new CourseError("validation_failed", parsed.error.flatten());
  const q = parsed.data;

  const items = await db.course.findMany({
    where: {
      status: "published",
      ...(q.category ? { category: q.category } : {}),
      ...(q.level ? { level: q.level } : {}),
      ...(q.language ? { language: q.language } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: "insensitive" } },
              { description: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      level: true,
      category: true,
      language: true,
      coverUrl: true,
      publishedAt: true,
    },
  });

  const hasMore = items.length > q.limit;
  const trimmed = hasMore ? items.slice(0, q.limit) : items;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]!.id : null;
  return { items: trimmed, nextCursor };
}

/** Returns full course tree. Visibility: published OR (actor can edit). */
export async function getCourseDetail(
  idOrSlug: string,
  actorUserId: string | null,
  db: PrismaClient = prisma,
) {
  const where = idOrSlug.includes("-") && idOrSlug.length < 36
    ? { slug: idOrSlug }
    : isUuid(idOrSlug)
      ? { id: idOrSlug }
      : { slug: idOrSlug };

  const course = await db.course.findUnique({
    where,
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              contentItems: { orderBy: { orderIndex: "asc" } },
              skillTags: { include: { skill: true } },
            },
          },
        },
      },
      instructors: { include: { user: { select: { id: true, displayName: true } } } },
    },
  });
  if (!course) throw new CourseError("not_found");

  if (course.status !== "published") {
    if (!actorUserId) throw new CourseError("not_found"); // 404, don't leak existence
    const ok = await canEditCourseInline(actorUserId, course.id, db);
    if (!ok) throw new CourseError("not_found");
  }
  return course;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// Inline version to avoid circular import via authz.ts.
async function canEditCourseInline(
  userId: string,
  courseId: string,
  db: PrismaClient,
): Promise<boolean> {
  const [admin, ci] = await Promise.all([
    db.userRole.findFirst({
      where: { userId, role: { name: RoleName.Admin } },
      select: { id: true },
    }),
    db.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId } },
      select: { id: true },
    }),
  ]);
  return admin !== null || ci !== null;
}

/**
 * Deep-clone a course (modules, lessons, content items, quizzes, questions,
 * options, skill tags). NEW course is `draft` and version=1; the actor becomes
 * the owner instructor. Does NOT clone enrollments, attempts, or learning
 * events — those belong to learners on the original.
 */
export async function duplicateCourse(
  actorUserId: string,
  sourceCourseId: string,
  db: PrismaClient = prisma,
): Promise<{ courseId: string }> {
  await assertCanEditCourse(actorUserId, sourceCourseId, db);
  const src = await db.course.findUniqueOrThrow({
    where: { id: sourceCourseId },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              contentItems: { orderBy: { orderIndex: "asc" } },
              skillTags: true,
              quizzes: {
                include: {
                  questions: {
                    orderBy: { orderIndex: "asc" },
                    include: { options: { orderBy: { orderIndex: "asc" } }, skillTags: true },
                  },
                },
              },
              assignments: true,
            },
          },
        },
      },
    },
  });

  const newSlug = await uniqueCourseSlug(`${src.slug}-copy`, db);

  return db.$transaction(async (tx) => {
    const newCourse = await tx.course.create({
      data: {
        slug: newSlug,
        title: `${src.title} (copy)`,
        description: src.description,
        language: src.language,
        level: src.level,
        category: src.category,
        coverUrl: src.coverUrl,
        status: "draft",
        version: 1,
      },
    });
    await tx.courseInstructor.create({
      data: { courseId: newCourse.id, userId: actorUserId, role: "owner" },
    });

    for (const m of src.modules) {
      const newModule = await tx.module.create({
        data: {
          courseId: newCourse.id,
          title: m.title,
          orderIndex: m.orderIndex,
        },
      });
      for (const l of m.lessons) {
        const newLesson = await tx.lesson.create({
          data: {
            moduleId: newModule.id,
            title: l.title,
            description: l.description,
            orderIndex: l.orderIndex,
            completionThresholdPct: l.completionThresholdPct,
            durationSec: l.durationSec,
          },
        });
        for (const c of l.contentItems) {
          await tx.contentItem.create({
            data: {
              lessonId: newLesson.id,
              type: c.type,
              payload: c.payload === null ? Prisma.JsonNull : (c.payload as Prisma.InputJsonValue),
              orderIndex: c.orderIndex,
            },
          });
        }
        for (const t of l.skillTags) {
          await tx.contentSkillMapping.create({
            data: {
              contentType: "lesson",
              contentId: newLesson.id,
              skillId: t.skillId,
              coverageWeight: t.coverageWeight,
            },
          });
        }
        for (const a of l.assignments) {
          await tx.assignment.create({
            data: {
              lessonId: newLesson.id,
              title: a.title,
              description: a.description,
              dueAt: a.dueAt,
              maxScore: a.maxScore,
            },
          });
        }
        for (const q of l.quizzes) {
          const newQuiz = await tx.quiz.create({
            data: {
              lessonId: newLesson.id,
              courseId: newCourse.id,
              title: q.title,
              description: q.description,
              difficulty: q.difficulty,
              passThresholdPct: q.passThresholdPct,
              timeLimitSec: q.timeLimitSec,
              maxAttempts: q.maxAttempts,
              randomizeOrder: q.randomizeOrder,
              requireConfidence: q.requireConfidence,
            },
          });
          for (const qq of q.questions) {
            const newQuestion = await tx.quizQuestion.create({
              data: {
                quizId: newQuiz.id,
                type: qq.type,
                prompt: qq.prompt,
                explanation: qq.explanation,
                points: qq.points,
                orderIndex: qq.orderIndex,
                extra: qq.extra === null ? Prisma.JsonNull : (qq.extra as Prisma.InputJsonValue),
                options: {
                  create: qq.options.map((o) => ({
                    label: o.label,
                    isCorrect: o.isCorrect,
                    orderIndex: o.orderIndex,
                    misconceptionId: o.misconceptionId,
                    extra: o.extra === null ? Prisma.JsonNull : (o.extra as Prisma.InputJsonValue),
                  })),
                },
              },
            });
            for (const t of qq.skillTags) {
              await tx.questionSkillTag.create({
                data: { questionId: newQuestion.id, skillId: t.skillId },
              });
            }
          }
        }
      }
    }

    await logAudit(
      {
        action: "course.duplicated",
        actorUserId,
        payload: { sourceCourseId, newCourseId: newCourse.id },
      },
      tx,
    );

    return { courseId: newCourse.id };
  });
}

export { CourseAuthzError };
