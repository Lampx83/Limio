/**
 * Export every learner-facing string of a course to one JSON file, keyed by row id,
 * so it can be translated and written back with scripts/i18n-apply-course.ts.
 *
 *   tsx scripts/i18n-export-course.ts <course-slug> <out.json>
 *
 * What is exported (and therefore what a translation covers):
 *   course title/description, module titles, lesson title/description, the text of
 *   markdown content items and the title of PDF items, quiz title/description,
 *   question prompt/explanation, option labels, assignment title/description, and
 *   the skills and misconceptions that learners see in feedback.
 *
 * Read-only.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";

async function main() {
  const [slug, out] = process.argv.slice(2);
  if (!slug || !out) {
    console.error("usage: i18n-export-course.ts <course-slug> <out.json>");
    process.exit(1);
  }
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, description: true, category: true },
  });
  if (!course) throw new Error(`no course ${slug}`);

  const modules = await prisma.module.findMany({
    where: { courseId: course.id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, title: true, orderIndex: true },
  });

  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id } },
    orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      orderIndex: true,
      module: { select: { orderIndex: true } },
      contentItems: {
        where: { type: { in: ["markdown", "pdf", "richtext"] } },
        orderBy: { orderIndex: "asc" },
        select: { id: true, type: true, payload: true },
      },
      quizzes: {
        orderBy: [{ cuepointOnly: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          cuepointOnly: true,
          questions: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              type: true,
              prompt: true,
              explanation: true,
              options: {
                orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
                select: { id: true, label: true, isCorrect: true, orderIndex: true, misconceptionId: true },
              },
            },
          },
        },
      },
      assignments: { select: { id: true, title: true, description: true } },
    },
  });

  // Skills learners see: tagged on lessons or on questions of this course.
  const lessonIds = lessons.map((l) => l.id);
  const questionIds = lessons.flatMap((l) => l.quizzes.flatMap((q) => q.questions.map((x) => x.id)));
  const lessonSkillIds = (
    await prisma.contentSkillMapping.findMany({
      where: { contentType: "lesson", contentId: { in: lessonIds } },
      select: { skillId: true, contentId: true },
    })
  );
  const qSkillIds = await prisma.questionSkillTag.findMany({
    where: { questionId: { in: questionIds } },
    select: { skillId: true },
  });
  const skillIds = [...new Set([...lessonSkillIds.map((s) => s.skillId), ...qSkillIds.map((s) => s.skillId)])];
  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds } },
    select: { id: true, code: true, name: true, description: true },
    orderBy: { code: "asc" },
  });

  const misIds = [
    ...new Set(
      lessons.flatMap((l) =>
        l.quizzes.flatMap((q) => q.questions.flatMap((x) => x.options.map((o) => o.misconceptionId).filter((m): m is string => !!m))),
      ),
    ),
  ];
  const misconceptions = await prisma.misconception.findMany({
    where: { id: { in: misIds } },
    select: { id: true, code: true, name: true, description: true },
    orderBy: { code: "asc" },
  });

  const shaped = lessons.map((l) => ({
    id: l.id,
    mod: l.module.orderIndex,
    order: l.orderIndex,
    title: l.title,
    description: l.description,
    items: l.contentItems.map((c) => {
      const p = c.payload as { body?: string; title?: string; url?: string };
      return c.type === "pdf" ? { id: c.id, type: c.type, pdfTitle: p.title ?? null } : { id: c.id, type: c.type, body: p.body ?? "" };
    }),
    quizzes: l.quizzes.map((q) => ({
      id: q.id,
      cue: q.cuepointOnly,
      title: q.title,
      description: q.description,
      questions: q.questions.map((x) => ({
        id: x.id,
        type: x.type,
        prompt: x.prompt,
        explanation: x.explanation,
        options: x.options.map((o) => ({ id: o.id, label: o.label, correct: o.isCorrect })),
      })),
    })),
    assignments: l.assignments,
  }));

  const doc = { course, modules, lessons: shaped, skills, misconceptions };
  writeFileSync(out, JSON.stringify(doc, null, 1));

  const chars = JSON.stringify(doc).length;
  const qCount = shaped.reduce((s, l) => s + l.quizzes.reduce((t, q) => t + q.questions.length, 0), 0);
  console.log(`${slug}: ${lessons.length} lessons, ${qCount} questions, ${skills.length} skills, ${misconceptions.length} misconceptions, ${(chars / 1000).toFixed(0)}k chars -> ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
