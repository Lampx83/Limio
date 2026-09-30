/**
 * Remove quizzes left behind when a lesson was deleted.
 *
 * `deleteLesson` removes the lesson but a Quiz's lessonId FK is SET NULL, so the
 * quizzes (including in-video cuepoint quizzes) of a deleted lesson stay in the
 * course with no lesson. Learners never see them, but they clutter the
 * instructor's quiz list and question bank.
 *
 *   tsx scripts/cleanup-orphan-quizzes.ts <course-slug> [--apply]
 *
 * Without --apply it only reports. A quiz is treated as an orphan ONLY if all of
 * these hold, so nothing that is still wired into something is touched:
 *   - it belongs to the course but has no lesson,
 *   - it backs no tournament mission and no live game session,
 *   - it has no lesson-timeline row,
 *   - no video content item references it as a cuepoint.
 *
 * Deleting goes through the deleteQuiz service (authorisation + transaction).
 * Quizzes that still have learner attempts are reported and only deleted with
 * --force-attempts, because those attempts are deleted with them.
 */
import { prisma } from "@feedbackme/db";
import { deleteQuiz } from "@feedbackme/core-lms";

async function main() {
  const slug = process.argv[2];
  const apply = process.argv.includes("--apply");
  const forceAttempts = process.argv.includes("--force-attempts");
  if (!slug || slug.startsWith("--")) {
    console.error("usage: cleanup-orphan-quizzes.ts <course-slug> [--apply] [--force-attempts]");
    process.exit(1);
  }

  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) throw new Error(`no course ${slug}`);
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error("course has no owner");

  const candidates = await prisma.quiz.findMany({
    where: {
      courseId: course.id,
      lessonId: null,
      tournamentMissionId: null,
      lessonActivity: null,
      gameSessions: { none: {} },
    },
    select: { id: true, title: true, cuepointOnly: true, _count: { select: { attempts: true } } },
  });

  const videoPayloads = (
    await prisma.contentItem.findMany({
      where: { type: "video", lesson: { module: { courseId: course.id } } },
      select: { payload: true },
    })
  ).map((v) => JSON.stringify(v.payload));

  const orphans = candidates.filter((q) => !videoPayloads.some((p) => p.includes(q.id)));
  const withAttempts = orphans.filter((q) => q._count.attempts > 0);

  console.log(`${slug}: ${candidates.length} quiz without a lesson, ${orphans.length} truly orphaned`);
  console.log(`  cuepoint quizzes: ${orphans.filter((q) => q.cuepointOnly).length}, lesson quizzes: ${orphans.filter((q) => !q.cuepointOnly).length}`);
  console.log(`  with learner attempts: ${withAttempts.length} (${withAttempts.reduce((s, q) => s + q._count.attempts, 0)} attempts)`);

  if (!apply) {
    console.log("\nDry run — nothing deleted. Rerun with --apply.");
    return;
  }

  let deleted = 0;
  let skipped = 0;
  for (const q of orphans) {
    if (q._count.attempts > 0 && !forceAttempts) {
      skipped++;
      console.log(`  skip (has ${q._count.attempts} attempt(s), pass --force-attempts): ${q.title}`);
      continue;
    }
    await deleteQuiz(owner.userId, q.id, { force: q._count.attempts > 0 }, prisma);
    deleted++;
  }
  console.log(`\nDeleted ${deleted}, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
