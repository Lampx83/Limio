/**
 * Insert a "Course Overview" lesson as the first lesson of a course's first
 * module (module orderIndex 0). Existing lessons in that module shift down by
 * one. Adds a markdown body and one skill tag so a personalization-enabled
 * course stays publishable. Video is attached separately (attach-lesson-video).
 *
 *   tsx scripts/insert-intro-lesson.ts <course-slug>
 *
 * Idempotent: if a "Course Overview" lesson already exists in module 0, it
 * reports and exits without shifting anything.
 */
import { prisma } from "@feedbackme/db";
import { createLesson, createContentItem, createSkill, tagLessonSkill } from "@feedbackme/core-lms";

const LESSON_TITLE = "Course Overview";
const SKILL = {
  code: "ml.intro.overview",
  name: "Overview of machine learning and the data science landscape",
  description:
    "How computer science, AI, machine learning, and data science relate; the feedback loop by which learners improve; and the common types of data machine learning works with.",
};
const BODY =
  "## Course Overview\n\n" +
  "An introduction to the course and the field it belongs to.\n\n" +
  "### What this video covers\n\n" +
  "- How computer science, AI, machine learning, and deep learning relate to one another, and where data science sits\n" +
  "- The learning loop — exercise, submission, feedback from a teacher, and improvement — that motivates personalized feedback\n" +
  "- The common types of data machine learning works with: tabular, text, images, and audio\n\n" +
  "### Where this course fits\n\n" +
  "This course delivers job-ready machine learning skills using Python and Scikit-learn. It builds directly on the programming foundation from *Programming for Data Science*.";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: insert-intro-lesson.ts <course-slug>");
    process.exit(1);
  }

  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) throw new Error(`no course ${slug}`);

  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error(`course ${slug} has no owner`);

  const mod = await prisma.module.findFirst({
    where: { courseId: course.id },
    orderBy: { orderIndex: "asc" },
  });
  if (!mod) throw new Error(`course ${slug} has no modules`);

  const existing = await prisma.lesson.findFirst({
    where: { moduleId: mod.id, title: LESSON_TITLE },
  });
  if (existing) {
    console.log(`"${LESSON_TITLE}" already exists in ${slug} module 0 — nothing to do.`);
    return;
  }

  // Shift existing lessons down by one, highest orderIndex first so each target
  // slot is free when we write it — the (moduleId, orderIndex) unique constraint
  // is checked per statement, not deferred.
  const lessons = await prisma.lesson.findMany({
    where: { moduleId: mod.id },
    orderBy: { orderIndex: "desc" },
    select: { id: true, orderIndex: true },
  });
  for (const l of lessons) {
    await prisma.lesson.update({
      where: { id: l.id },
      data: { orderIndex: l.orderIndex + 1 },
    });
  }
  console.log(`Shifted ${lessons.length} lesson(s) down by one in module "${mod.title}".`);

  const { lessonId } = await createLesson(
    owner.userId,
    mod.id,
    {
      title: LESSON_TITLE,
      orderIndex: 0,
      description: "How ML, AI, and data science relate — and where this course sits.",
    },
    prisma,
  );

  await createContentItem(
    owner.userId,
    lessonId,
    { type: "markdown", payload: { body: BODY }, orderIndex: 0 },
    prisma,
  );

  // createSkill throws on a duplicate code rather than upserting, so pre-check.
  const existingSkill = await prisma.skill.findUnique({ where: { code: SKILL.code } });
  const skillId = existingSkill?.id ?? (await createSkill(SKILL, prisma)).skillId;
  await tagLessonSkill(owner.userId, lessonId, { skillId }, prisma);

  console.log(`Created "${LESSON_TITLE}" at orderIndex 0 in ${slug}, tagged ${SKILL.code}.`);
  console.log(`Lesson id: ${lessonId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
