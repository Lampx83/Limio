/**
 * Attach a local video file to a lesson as a `video` ContentItem.
 *
 * Mirrors what POST /api/lesson-media/videos + AddContentItemForm do, minus
 * the browser: same storage layer, same key builder, same randomised
 * capability filename, then createContentItem (which also writes the
 * LessonActivity row the lesson timeline reads).
 *
 *   tsx scripts/attach-lesson-video.ts <file.mp4> <course-slug> <lesson-title-substring> [durationSec]
 *
 * Idempotent on the lesson: if the lesson already has a video ContentItem it
 * reports and exits rather than uploading the blob twice.
 */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonVideoKey } from "../src/lib/storage-keys";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const EXT_TO_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

async function main() {
  const [filePath, courseSlug, lessonMatch, durationRaw] = process.argv.slice(2);
  if (!filePath || !courseSlug || !lessonMatch) {
    console.error(
      "usage: attach-lesson-video.ts <file> <course-slug> <lesson-title-substring> [durationSec]",
    );
    process.exit(1);
  }

  const mime = EXT_TO_MIME[extname(filePath).toLowerCase()];
  if (!mime) throw new Error(`unsupported video extension: ${extname(filePath)}`);

  const lesson = await prisma.lesson.findFirst({
    where: {
      title: { contains: lessonMatch },
      module: { course: { slug: courseSlug } },
    },
    include: {
      module: { include: { course: { select: { slug: true, title: true } } } },
      contentItems: { select: { id: true, type: true, orderIndex: true } },
    },
  });
  if (!lesson) throw new Error(`no lesson matching "${lessonMatch}" in course ${courseSlug}`);

  console.log(`Course: ${lesson.module.course.title}`);
  console.log(`Lesson: ${lesson.title}`);

  if (lesson.contentItems.some((c) => c.type === "video")) {
    console.log("Lesson already has a video content item — nothing to do.");
    return;
  }

  // Owner of the course acts, so assertCanEditCourse passes and the audit
  // trail names a real instructor rather than a synthetic actor.
  const owner = await prisma.courseInstructor.findFirst({
    where: { course: { slug: courseSlug }, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error(`course ${courseSlug} has no owner instructor`);

  const buf = await readFile(filePath);
  if (buf.byteLength === 0) throw new Error("empty file");
  if (buf.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(`file too large: ${buf.byteLength} > ${MAX_VIDEO_BYTES}`);
  }

  // Capability filename — unguessable suffix, same shape the route emits.
  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${owner.userId}-${now.getTime()}-${suffix}${extname(filePath).toLowerCase()}`;
  const key = lessonVideoKey(now, filename);

  console.log(
    `Uploading ${basename(filePath)} (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB) -> ${key.layer}/${key.key}`,
  );
  await storageFor(key).put(key.key, buf, mime);

  const durationSec = durationRaw ? Number.parseInt(durationRaw, 10) : undefined;
  const orderIndex = lesson.contentItems.length;
  const { contentItemId } = await createContentItem(
    owner.userId,
    lesson.id,
    {
      type: "video",
      payload: {
        url: `/api/lesson-media/videos/${filename}`,
        ...(durationSec ? { durationSec } : {}),
      },
      orderIndex,
    },
    prisma,
  );

  console.log(`ContentItem ${contentItemId} created at orderIndex ${orderIndex}.`);
  console.log(`URL: /api/lesson-media/videos/${filename}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
