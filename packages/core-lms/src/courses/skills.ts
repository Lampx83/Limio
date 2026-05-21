import { z } from "zod";
import { prisma } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { assertCanEditCourse, CourseAuthzError } from "./authz";
import { CourseError } from "./courses";

export const CreateSkillInput = z.object({
  code: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z][a-z0-9._-]*$/, "must be lowercase, dot/dash/underscore segments"),
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(5_000).optional(),
});

export const TagLessonSkillInput = z.object({
  skillId: z.string().uuid(),
  coverageWeight: z.number().min(0).max(1).optional(),
});

export class SkillError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "skill_not_found"
      | "skill_code_taken"
      | "lesson_not_found"
      | "tag_not_found"
      | "skill_in_use"
      | "prerequisite_cycle"
      | "self_prerequisite",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export const UpdateSkillInput = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(5_000).nullable().optional(),
});

export async function createSkill(
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<{ skillId: string }> {
  const parsed = CreateSkillInput.safeParse(rawInput);
  if (!parsed.success) throw new SkillError("validation_failed", parsed.error.flatten());
  const existing = await db.skill.findUnique({ where: { code: parsed.data.code } });
  if (existing) throw new SkillError("skill_code_taken");
  const s = await db.skill.create({ data: parsed.data });
  return { skillId: s.id };
}

export async function listSkills(
  query: { q?: string; limit?: number } = {},
  db: DbClient = prisma,
) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  return db.skill.findMany({
    where: query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : undefined,
    take: limit,
    orderBy: { code: "asc" },
  });
}

export async function updateSkill(
  skillId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const parsed = UpdateSkillInput.safeParse(rawInput);
  if (!parsed.success) throw new SkillError("validation_failed", parsed.error.flatten());
  const existing = await db.skill.findUnique({ where: { id: skillId } });
  if (!existing) throw new SkillError("skill_not_found");
  await db.skill.update({
    where: { id: skillId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
    },
  });
}

export async function getSkillUsage(
  skillId: string,
  db: DbClient = prisma,
): Promise<{
  contentMappings: number;
  questionTags: number;
  learnerStates: number;
  feedbackTemplates: number;
}> {
  const [contentMappings, questionTags, learnerStates, feedbackTemplates] =
    await Promise.all([
      db.contentSkillMapping.count({ where: { skillId } }),
      db.questionSkillTag.count({ where: { skillId } }),
      db.learnerSkillState.count({ where: { skillId } }),
      db.feedbackTemplate.count({ where: { skillId } }),
    ]);
  return { contentMappings, questionTags, learnerStates, feedbackTemplates };
}

export async function deleteSkill(
  skillId: string,
  opts: { force?: boolean } = {},
  db: DbClient = prisma,
): Promise<void> {
  const existing = await db.skill.findUnique({ where: { id: skillId } });
  if (!existing) throw new SkillError("skill_not_found");
  if (!opts.force) {
    const usage = await getSkillUsage(skillId, db);
    const total =
      usage.contentMappings +
      usage.questionTags +
      usage.learnerStates +
      usage.feedbackTemplates;
    if (total > 0) throw new SkillError("skill_in_use", usage);
  }
  await db.skill.delete({ where: { id: skillId } });
}

/** Add `prereqId` as a prerequisite of `skillId`. Cycle-safe. */
export async function addSkillPrerequisite(
  skillId: string,
  prereqId: string,
  db: DbClient = prisma,
): Promise<{ created: boolean }> {
  if (skillId === prereqId) throw new SkillError("self_prerequisite");
  const [skill, prereq] = await Promise.all([
    db.skill.findUnique({ where: { id: skillId }, select: { id: true } }),
    db.skill.findUnique({ where: { id: prereqId }, select: { id: true } }),
  ]);
  if (!skill || !prereq) throw new SkillError("skill_not_found");

  // Cycle detection: would adding (skill → prereq) create a path from prereq back to skill?
  // Walk forward from skillId via existing prerequisite edges; if we ever reach prereqId, cycle.
  const visited = new Set<string>();
  const stack: string[] = [skillId];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === prereqId) throw new SkillError("prerequisite_cycle");
    if (visited.has(node)) continue;
    visited.add(node);
    const edges = await db.skillPrerequisite.findMany({
      where: { prerequisiteSkillId: node },
      select: { skillId: true },
    });
    for (const e of edges) stack.push(e.skillId);
  }

  const existing = await db.skillPrerequisite.findUnique({
    where: { skillId_prerequisiteSkillId: { skillId, prerequisiteSkillId: prereqId } },
  });
  if (existing) return { created: false };
  await db.skillPrerequisite.create({
    data: { skillId, prerequisiteSkillId: prereqId },
  });
  return { created: true };
}

export async function removeSkillPrerequisite(
  skillId: string,
  prereqId: string,
  db: DbClient = prisma,
): Promise<void> {
  const existing = await db.skillPrerequisite.findUnique({
    where: { skillId_prerequisiteSkillId: { skillId, prerequisiteSkillId: prereqId } },
  });
  if (!existing) throw new SkillError("tag_not_found");
  await db.skillPrerequisite.delete({
    where: { skillId_prerequisiteSkillId: { skillId, prerequisiteSkillId: prereqId } },
  });
}

export async function listSkillsWithStats(db: DbClient = prisma) {
  const skills = await db.skill.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      createdAt: true,
      _count: {
        select: {
          contentMappings: true,
          questionTags: true,
          prerequisites: true,
          dependents: true,
        },
      },
    },
  });
  return skills;
}

export async function getSkillDetail(
  skillId: string,
  db: DbClient = prisma,
) {
  const skill = await db.skill.findUnique({
    where: { id: skillId },
    include: {
      prerequisites: {
        include: {
          prerequisite: { select: { id: true, code: true, name: true } },
        },
      },
      dependents: {
        include: {
          skill: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });
  if (!skill) throw new SkillError("skill_not_found");
  const usage = await getSkillUsage(skillId, db);
  return { skill, usage };
}

async function getCourseIdForLesson(lessonId: string, db: DbClient): Promise<string> {
  const row = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!row) throw new SkillError("lesson_not_found");
  return row.module.courseId;
}

export async function tagLessonSkill(
  actorUserId: string,
  lessonId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<{ mappingId: string; created: boolean }> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = TagLessonSkillInput.safeParse(rawInput);
  if (!parsed.success) throw new SkillError("validation_failed", parsed.error.flatten());

  const skill = await db.skill.findUnique({ where: { id: parsed.data.skillId } });
  if (!skill) throw new SkillError("skill_not_found");

  const existing = await db.contentSkillMapping.findUnique({
    where: {
      contentType_contentId_skillId: {
        contentType: "lesson",
        contentId: lessonId,
        skillId: parsed.data.skillId,
      },
    },
  });
  if (existing) return { mappingId: existing.id, created: false };

  const m = await db.contentSkillMapping.create({
    data: {
      contentType: "lesson",
      contentId: lessonId,
      skillId: parsed.data.skillId,
      coverageWeight: parsed.data.coverageWeight ?? 1.0,
    },
  });
  return { mappingId: m.id, created: true };
}

export async function untagLessonSkill(
  actorUserId: string,
  lessonId: string,
  skillId: string,
  db: DbClient = prisma,
): Promise<void> {
  const courseId = await getCourseIdForLesson(lessonId, db);
  await assertCanEditCourse(actorUserId, courseId, db);
  const mapping = await db.contentSkillMapping.findUnique({
    where: {
      contentType_contentId_skillId: { contentType: "lesson", contentId: lessonId, skillId },
    },
  });
  if (!mapping) throw new SkillError("tag_not_found");
  await db.contentSkillMapping.delete({ where: { id: mapping.id } });
}

// =====================================================================
// Coverage analytics for the instructor Skill Tagging hub.
// "Live" = course.status = published AND lesson.isHidden = false. These
// rows are the highest-priority gap because learners can see them but
// the Feedback Engine has nothing to model.
// =====================================================================

export interface SkillCoverageSummary {
  courses: Array<{
    courseId: string;
    courseTitle: string;
    courseStatus: string;
    personalizationEnabled: boolean;
    totalLessons: number;
    taggedLessons: number;
    totalQuestions: number;
    taggedQuestions: number;
  }>;
  totals: {
    totalLessons: number;
    taggedLessons: number;
    totalQuestions: number;
    taggedQuestions: number;
    untaggedLiveLessons: number;
    untaggedLiveQuestions: number;
  };
}

export interface UntaggedLessonRow {
  lessonId: string;
  lessonTitle: string;
  isHidden: boolean;
  courseId: string;
  courseTitle: string;
  courseStatus: string;
  moduleTitle: string;
}

export interface UntaggedQuestionRow {
  questionId: string;
  prompt: string;
  quizId: string;
  quizTitle: string;
  courseId: string;
  courseTitle: string;
  courseStatus: string;
}

export async function getInstructorSkillCoverage(
  userId: string,
  db: DbClient = prisma,
): Promise<SkillCoverageSummary> {
  const courses = await db.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true, status: true, personalizationEnabled: true },
    orderBy: { title: "asc" },
  });
  if (courses.length === 0) {
    return {
      courses: [],
      totals: {
        totalLessons: 0,
        taggedLessons: 0,
        totalQuestions: 0,
        taggedQuestions: 0,
        untaggedLiveLessons: 0,
        untaggedLiveQuestions: 0,
      },
    };
  }

  const courseIds = courses.map((c) => c.id);

  // Pull every lesson + question in one batch, then aggregate client-side.
  const lessons = await db.lesson.findMany({
    where: { module: { courseId: { in: courseIds } } },
    select: {
      id: true,
      isHidden: true,
      module: { select: { courseId: true } },
    },
  });
  const lessonIds = lessons.map((l) => l.id);

  const taggedLessonIds = new Set(
    (
      await db.contentSkillMapping.findMany({
        where: { contentType: "lesson", contentId: { in: lessonIds } },
        select: { contentId: true },
        distinct: ["contentId"],
      })
    ).map((m) => m.contentId),
  );

  const quizzes = await db.quiz.findMany({
    where: {
      OR: [
        { courseId: { in: courseIds } },
        { lessonId: { in: lessonIds } },
      ],
    },
    select: {
      id: true,
      courseId: true,
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  const quizCourseById = new Map<string, string | null>();
  for (const qz of quizzes) {
    quizCourseById.set(qz.id, qz.courseId ?? qz.lesson?.module?.courseId ?? null);
  }

  const questions = await db.quizQuestion.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) } },
    select: { id: true, quizId: true },
  });
  const questionIds = questions.map((q) => q.id);

  const taggedQuestionIds = new Set(
    (
      await db.questionSkillTag.findMany({
        where: { questionId: { in: questionIds } },
        select: { questionId: true },
        distinct: ["questionId"],
      })
    ).map((t) => t.questionId),
  );

  const perCourse = courses.map((c) => {
    const courseLessons = lessons.filter((l) => l.module.courseId === c.id);
    const courseQuestions = questions.filter((q) => {
      const cid = quizCourseById.get(q.quizId);
      return cid === c.id;
    });
    const taggedLessons = courseLessons.filter((l) => taggedLessonIds.has(l.id))
      .length;
    const taggedQuestions = courseQuestions.filter((q) =>
      taggedQuestionIds.has(q.id),
    ).length;
    return {
      courseId: c.id,
      courseTitle: c.title,
      courseStatus: c.status,
      personalizationEnabled: c.personalizationEnabled,
      totalLessons: courseLessons.length,
      taggedLessons,
      totalQuestions: courseQuestions.length,
      taggedQuestions,
      untaggedLiveLessons:
        c.status === "published"
          ? courseLessons.filter(
              (l) => !l.isHidden && !taggedLessonIds.has(l.id),
            ).length
          : 0,
      untaggedLiveQuestions:
        c.status === "published"
          ? courseQuestions.filter((q) => !taggedQuestionIds.has(q.id)).length
          : 0,
    };
  });

  const totals = perCourse.reduce(
    (acc, c) => {
      acc.totalLessons += c.totalLessons;
      acc.taggedLessons += c.taggedLessons;
      acc.totalQuestions += c.totalQuestions;
      acc.taggedQuestions += c.taggedQuestions;
      acc.untaggedLiveLessons += c.untaggedLiveLessons;
      acc.untaggedLiveQuestions += c.untaggedLiveQuestions;
      return acc;
    },
    {
      totalLessons: 0,
      taggedLessons: 0,
      totalQuestions: 0,
      taggedQuestions: 0,
      untaggedLiveLessons: 0,
      untaggedLiveQuestions: 0,
    },
  );

  return {
    courses: perCourse.map(
      ({
        untaggedLiveLessons: _ull,
        untaggedLiveQuestions: _ulq,
        ...rest
      }) => rest,
    ),
    totals,
  };
}

export async function listUntaggedLessons(
  userId: string,
  opts: {
    courseId?: string;
    limit?: number;
    personalizationEnabledOnly?: boolean;
  } = {},
  db: DbClient = prisma,
): Promise<UntaggedLessonRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const lessons = await db.lesson.findMany({
    where: {
      module: {
        course: {
          instructors: { some: { userId } },
          ...(opts.courseId ? { id: opts.courseId } : {}),
          ...(opts.personalizationEnabledOnly
            ? { personalizationEnabled: true }
            : {}),
        },
      },
      skillTags: { none: {} },
    },
    select: {
      id: true,
      title: true,
      isHidden: true,
      orderIndex: true,
      module: {
        select: {
          title: true,
          orderIndex: true,
          course: { select: { id: true, title: true, status: true } },
        },
      },
    },
    take: limit,
  });

  return lessons
    .map<UntaggedLessonRow & { _sort: [number, string, number, number] }>(
      (l) => ({
        lessonId: l.id,
        lessonTitle: l.title,
        isHidden: l.isHidden,
        courseId: l.module.course.id,
        courseTitle: l.module.course.title,
        courseStatus: l.module.course.status,
        moduleTitle: l.module.title,
        _sort: [
          l.module.course.status === "published" && !l.isHidden ? 0 : 1,
          l.module.course.title,
          l.module.orderIndex,
          l.orderIndex,
        ],
      }),
    )
    .sort((a, b) => {
      if (a._sort[0] !== b._sort[0]) return a._sort[0] - b._sort[0];
      if (a._sort[1] !== b._sort[1]) return a._sort[1].localeCompare(b._sort[1]);
      if (a._sort[2] !== b._sort[2]) return a._sort[2] - b._sort[2];
      return a._sort[3] - b._sort[3];
    })
    .map(({ _sort: _s, ...row }) => row);
}

export async function listUntaggedQuestions(
  userId: string,
  opts: {
    courseId?: string;
    limit?: number;
    personalizationEnabledOnly?: boolean;
  } = {},
  db: DbClient = prisma,
): Promise<UntaggedQuestionRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);

  // Find candidate courses (owned, optional filter).
  const ownedCourses = await db.course.findMany({
    where: {
      instructors: { some: { userId } },
      ...(opts.courseId ? { id: opts.courseId } : {}),
      ...(opts.personalizationEnabledOnly
        ? { personalizationEnabled: true }
        : {}),
    },
    select: { id: true, title: true, status: true },
  });
  if (ownedCourses.length === 0) return [];
  const courseIds = ownedCourses.map((c) => c.id);
  const courseById = new Map(ownedCourses.map((c) => [c.id, c]));

  // Lessons belonging to these courses — used to resolve quiz.lessonId → courseId.
  const lessons = await db.lesson.findMany({
    where: { module: { courseId: { in: courseIds } } },
    select: { id: true, module: { select: { courseId: true } } },
  });
  const lessonCourseById = new Map(
    lessons.map((l) => [l.id, l.module.courseId]),
  );

  const questions = await db.quizQuestion.findMany({
    where: {
      skillTags: { none: {} },
      quiz: {
        OR: [
          { courseId: { in: courseIds } },
          { lessonId: { in: lessons.map((l) => l.id) } },
        ],
      },
    },
    select: {
      id: true,
      prompt: true,
      orderIndex: true,
      quiz: {
        select: { id: true, title: true, courseId: true, lessonId: true },
      },
    },
    take: limit,
  });

  return questions
    .map<UntaggedQuestionRow & { _sort: [number, string, string, number] }>(
      (q) => {
        const courseId =
          q.quiz.courseId ??
          (q.quiz.lessonId ? lessonCourseById.get(q.quiz.lessonId) : null) ??
          "";
        const course = courseById.get(courseId);
        return {
          questionId: q.id,
          prompt: q.prompt.slice(0, 200),
          quizId: q.quiz.id,
          quizTitle: q.quiz.title,
          courseId,
          courseTitle: course?.title ?? "—",
          courseStatus: course?.status ?? "—",
          _sort: [
            course?.status === "published" ? 0 : 1,
            course?.title ?? "",
            q.quiz.title,
            q.orderIndex,
          ],
        };
      },
    )
    .sort((a, b) => {
      if (a._sort[0] !== b._sort[0]) return a._sort[0] - b._sort[0];
      if (a._sort[1] !== b._sort[1]) return a._sort[1].localeCompare(b._sort[1]);
      if (a._sort[2] !== b._sort[2]) return a._sort[2].localeCompare(b._sort[2]);
      return a._sort[3] - b._sort[3];
    })
    .map(({ _sort: _s, ...row }) => row);
}

export { CourseAuthzError };
