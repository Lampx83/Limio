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
      | "tag_not_found",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

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

export { CourseAuthzError };
