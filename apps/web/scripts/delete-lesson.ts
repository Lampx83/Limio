/**
 * Delete a lesson by course slug + exact title. Removes its skill mappings first
 * (ContentSkillMapping has ON DELETE RESTRICT to Lesson, so a plain delete would
 * fail on a tagged lesson), then deletes the lesson — content items, lesson
 * activities, notes, etc. cascade. Reports the video blob paths it references so
 * the caller can clean them off disk separately (blobs are not cascade-deleted).
 *
 *   tsx scripts/delete-lesson.ts <course-slug> "<exact lesson title>"
 *
 * Idempotent: if no matching lesson exists, reports and exits.
 */
import { prisma } from "@feedbackme/db";
import { deleteLesson } from "@feedbackme/core-lms";

async function main() {
  const [slug, title] = process.argv.slice(2);
  if (!slug || !title) {
    console.error('usage: delete-lesson.ts <course-slug> "<exact lesson title>"');
    process.exit(1);
  }

  const lesson = await prisma.lesson.findFirst({
    where: { title, module: { course: { slug } } },
    include: {
      module: { include: { course: { select: { id: true } } } },
      contentItems: { select: { type: true, payload: true } },
    },
  });
  if (!lesson) {
    console.log(`No lesson "${title}" in ${slug} — nothing to do.`);
    return;
  }

  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: lesson.module.course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error(`course ${slug} has no owner`);

  // Surface video blobs so they can be removed off the storage volume — deleting
  // the lesson removes the DB rows but never the files on disk.
  const videoUrls = lesson.contentItems
    .filter((c) => c.type === "video")
    .map((c) => (c.payload as { url?: string } | null)?.url)
    .filter((u): u is string => !!u);
  for (const u of videoUrls) console.log(`  orphaned video blob: ${u}`);

  // ContentSkillMapping.contentId -> Lesson is ON DELETE RESTRICT; clear it first.
  const removedTags = await prisma.contentSkillMapping.deleteMany({
    where: { contentType: "lesson", contentId: lesson.id },
  });
  if (removedTags.count > 0) console.log(`  removed ${removedTags.count} skill mapping(s)`);

  await deleteLesson(owner.userId, lesson.id, prisma);
  console.log(`Deleted lesson "${title}" from ${slug}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
