/**
 * GET /api/courses/:id/skill-groups
 *
 * Returns distinct skill groups (code prefixes) present in a course's content.
 * Used by the tournament mission builder so instructors can pick a skill group
 * from a dropdown instead of typing raw skill codes.
 *
 * A "skill group" is derived from the skill code convention:
 *   "zh_tech.vocab.parts" → group prefix = "zh_tech.vocab"  (first 2 segments)
 *   "python.oop.classes"  → group prefix = "python.oop"
 *   "safety"              → group prefix = "safety"          (single segment)
 *
 * Auth: public read (skill catalog is not sensitive). Caller may be an
 * unauthenticated preview or an instructor building a tournament.
 */
import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Derive the group prefix: first two dot-separated segments of a skill code. */
function groupPrefix(code: string): string {
  const parts = code.split(".");
  return parts.length >= 2 ? parts.slice(0, 2).join(".") : parts[0]!;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const courseId = params.id;

  // Verify the course exists.
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // ContentSkillMapping is polymorphic (contentType + contentId, no FK relations).
  // Pre-fetch lesson IDs and quiz IDs for this course so we can filter by contentId.
  const [courseLessons, courseQuizzes] = await Promise.all([
    prisma.lesson.findMany({
      where: { module: { courseId } },
      select: { id: true },
    }),
    prisma.quiz.findMany({
      where: { courseId },
      select: { id: true },
    }),
  ]);
  const lessonIds = courseLessons.map((l) => l.id);
  const quizIds = courseQuizzes.map((q) => q.id);

  // Collect all skills tagged into this course's lessons, quizzes, and questions.
  // Three sources: ContentSkillMapping (lesson/quiz), QuestionSkillTag (question).
  const [mappedSkills, questionSkills] = await Promise.all([
    // Skills tagged directly on lessons or quizzes via ContentSkillMapping.
    prisma.skill.findMany({
      where: {
        contentMappings: {
          some: {
            OR: [
              { contentType: "lesson", contentId: { in: lessonIds } },
              { contentType: "quiz", contentId: { in: quizIds } },
            ],
          },
        },
      },
      select: { code: true, name: true },
    }),

    // Skills tagged on questions that belong to quizzes of this course.
    prisma.skill.findMany({
      where: {
        questionTags: {
          some: {
            question: {
              quiz: { courseId },
            },
          },
        },
      },
      select: { code: true, name: true },
    }),
  ]);

  // Merge, deduplicate by code, derive groups.
  const allSkills = [...mappedSkills, ...questionSkills];
  const byCode = new Map<string, string>(); // code → name
  for (const s of allSkills) {
    byCode.set(s.code, s.name);
  }

  // Build group map: prefix → { skillCodes[], label }
  const groupMap = new Map<
    string,
    { prefix: string; label: string; count: number; skills: string[] }
  >();

  for (const [code, name] of byCode) {
    const prefix = groupPrefix(code);
    const existing = groupMap.get(prefix);
    if (existing) {
      existing.count++;
      existing.skills.push(code);
    } else {
      // Derive a human-readable label from the prefix segments.
      // e.g. "zh_tech.vocab" → "zh_tech / vocab"
      // Instructors can see both the prefix and count.
      groupMap.set(prefix, {
        prefix,
        label: prefix.replace(/_/g, " ").replace(/\./g, " / "),
        count: 1,
        skills: [code],
      });
    }
  }

  // Sort alphabetically by prefix for stable dropdown ordering.
  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.prefix.localeCompare(b.prefix),
  );

  return NextResponse.json({ groups, totalSkills: byCode.size });
}
