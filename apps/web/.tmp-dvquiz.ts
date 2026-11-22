/** Quiz cuối bài cho Data Visualization từ dv-quiz-data.ts. Idempotent theo tiêu đề; câu hỏi kế thừa tag của bài (B1.5). */
import { prisma } from "@feedbackme/db";
import { createQuiz, createQuestion } from "@feedbackme/core-lms";
import { QUIZZES } from "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/dv/dv-quiz-data";
const dry = process.argv.includes("--dry-run");
async function main() {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: "data-visualization-for-business-insights" } });
  const actor = (await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: course.id, role: "owner" } })).userId;
  for (const [n, items] of Object.entries(QUIZZES)) {
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId: course.id }, title: { startsWith: `${n} ·` } }, select: { id: true, title: true } });
    const title = `Quiz · Lesson ${n}`;
    if (await prisma.quiz.findFirst({ where: { lessonId: lesson.id, title } })) { console.log(`= ${title}`); continue; }
    if (dry) { console.log(`(dry) ${lesson.title}: ${items.length}`); continue; }
    const { quizId } = await createQuiz(actor, { courseId: course.id, lessonId: lesson.id }, { title, passThresholdPct: 70, requireConfidence: true }, prisma);
    for (const [i, [prompt, options, correct, explanation]] of items.entries())
      await createQuestion(actor, quizId, { type: "mcq", prompt, explanation, points: 1, orderIndex: i, options: options.map((label, k) => ({ label, isCorrect: k === correct })) }, prisma);
    console.log(`✔ ${lesson.title}: ${items.length} câu`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
