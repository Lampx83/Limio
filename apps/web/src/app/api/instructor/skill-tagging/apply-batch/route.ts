import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditCourse } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const MAX_MAPPINGS = 200;

const BodySchema = z.object({
  mappings: z
    .array(
      z.object({
        contentType: z.enum(["lesson", "question"]),
        contentId: z.string().uuid(),
        skillId: z.string().uuid(),
        coverageWeight: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1)
    .max(MAX_MAPPINGS),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = (await readJson(req)) as unknown;
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const lessonMappings = parsed.data.mappings.filter(
    (m) => m.contentType === "lesson",
  );
  const questionMappings = parsed.data.mappings.filter(
    (m) => m.contentType === "question",
  );

  // Resolve courseIds for authz in batch.
  const lessonCourseById = new Map<string, string>();
  if (lessonMappings.length > 0) {
    const lessons = await prisma.lesson.findMany({
      where: { id: { in: lessonMappings.map((m) => m.contentId) } },
      select: { id: true, module: { select: { courseId: true } } },
    });
    for (const l of lessons) {
      lessonCourseById.set(l.id, l.module.courseId);
    }
  }
  const questionCourseById = new Map<string, string>();
  if (questionMappings.length > 0) {
    const questions = await prisma.quizQuestion.findMany({
      where: { id: { in: questionMappings.map((m) => m.contentId) } },
      select: {
        id: true,
        quiz: {
          select: {
            courseId: true,
            lesson: { select: { module: { select: { courseId: true } } } },
          },
        },
      },
    });
    for (const q of questions) {
      const cid = q.quiz.courseId ?? q.quiz.lesson?.module?.courseId;
      if (cid) questionCourseById.set(q.id, cid);
    }
  }

  // Authz check — every distinct course must be editable.
  const allCourseIds = new Set<string>([
    ...lessonCourseById.values(),
    ...questionCourseById.values(),
  ]);
  for (const courseId of allCourseIds) {
    if (!(await canEditCourse(userId, courseId))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let createdLessons = 0;
  let skippedLessons = 0;
  let createdQuestions = 0;
  let skippedQuestions = 0;

  // Use createMany with skipDuplicates — idempotent.
  if (lessonMappings.length > 0) {
    const data = lessonMappings
      .filter((m) => lessonCourseById.has(m.contentId))
      .map((m) => ({
        contentType: "lesson" as const,
        contentId: m.contentId,
        skillId: m.skillId,
        coverageWeight: m.coverageWeight ?? 1.0,
      }));
    const res = await prisma.contentSkillMapping.createMany({
      data,
      skipDuplicates: true,
    });
    createdLessons = res.count;
    skippedLessons = data.length - res.count;
  }

  if (questionMappings.length > 0) {
    const data = questionMappings
      .filter((m) => questionCourseById.has(m.contentId))
      .map((m) => ({
        questionId: m.contentId,
        skillId: m.skillId,
        weight: m.coverageWeight ?? 1.0,
      }));
    const res = await prisma.questionSkillTag.createMany({
      data,
      skipDuplicates: true,
    });
    createdQuestions = res.count;
    skippedQuestions = data.length - res.count;
  }

  return NextResponse.json({
    createdLessons,
    skippedLessons,
    createdQuestions,
    skippedQuestions,
  });
}
