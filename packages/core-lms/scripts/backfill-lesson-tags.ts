/**
 * B1.5 AC-3.2 — retro-fit lesson tags onto courses that already exist.
 *
 * Idempotent: a second run reports 0 created everywhere. Only touches courses
 * with personalizationEnabled = true — a plain LMS course is left alone.
 *
 *   pnpm --filter @feedbackme/core-lms backfill:lesson-tags
 *   pnpm --filter @feedbackme/core-lms backfill:lesson-tags -- --dry-run
 */

import { prisma } from "@feedbackme/db";
import { backfillCourseTags } from "../src/courses/autoTags";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const courses = await prisma.course.findMany({
    where: { personalizationEnabled: true },
    select: { id: true, title: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  if (courses.length === 0) {
    console.log("Không có course nào bật personalization — không có gì để backfill.");
    return;
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Backfill ${courses.length} course bật personalization\n`,
  );

  const total = { skillsCreated: 0, mappingsCreated: 0, questionTagsCreated: 0 };

  for (const course of courses) {
    if (dryRun) {
      const [lessons, untaggedQuestions] = await Promise.all([
        prisma.lesson.count({ where: { module: { courseId: course.id } } }),
        prisma.quizQuestion.count({
          where: {
            skillTags: { none: {} },
            quiz: { lessonId: { not: null }, lesson: { module: { courseId: course.id } } },
          },
        }),
      ]);
      console.log(
        `  ${course.slug}: ${lessons} bài học, ${untaggedQuestions} câu hỏi chưa tag`,
      );
      continue;
    }

    const stats = await backfillCourseTags(course.id, {}, prisma);
    total.skillsCreated += stats.skillsCreated;
    total.mappingsCreated += stats.mappingsCreated;
    total.questionTagsCreated += stats.questionTagsCreated;
    console.log(
      `  ${course.slug}: +${stats.skillsCreated} chủ đề, ` +
        `+${stats.mappingsCreated} liên kết bài học, ` +
        `+${stats.questionTagsCreated} tag câu hỏi`,
    );
  }

  if (!dryRun) {
    console.log(
      `\nTổng: +${total.skillsCreated} chủ đề, +${total.mappingsCreated} liên kết, ` +
        `+${total.questionTagsCreated} tag câu hỏi`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
