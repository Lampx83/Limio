/**
 * Add the lecture slide deck to a course as its own lesson, right after "Course Overview":
 * a short markdown intro plus the slide deck as an embedded PDF (ContentItem type `pdf`).
 *
 *   tsx scripts/attach-lecture-slides.ts <course-slug> <slides.pdf>            # dry run
 *   tsx scripts/attach-lecture-slides.ts <course-slug> <slides.pdf> --apply
 *
 * Why a lesson of its own instead of attaching the PDF to an existing lesson: the lessons of this
 * course are laid out by their authors (objectives → video → body). A new lesson is additive and is
 * removed with one click, while changing theirs is not.
 *
 * The PDF blob is written through the same storage adapter and key builder as
 * POST /api/lesson-media/pdfs (same 50 MB cap, same `{userId}-{ms}-{hex}.pdf` name). With
 * UPLOADS_ROOT pointed at a scratch directory the blob lands there and has to be copied into the
 * production uploads volume afterwards — this script only writes the database rows.
 *
 * Idempotent: a lesson with the same title in the course means "already uploaded" and nothing is
 * written. Lessons after the insertion point are shifted down by one, highest first, because
 * (moduleId, orderIndex) is unique and is checked per statement.
 */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prisma } from "@feedbackme/db";
import { createContentItem, createLesson } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonPdfKey } from "../src/lib/storage-keys";

const LESSON_TITLE = "Lecture Slides";
const AFTER_TITLE = "Course Overview";
const MAX_PDF_BYTES = 50 * 1024 * 1024;

function body(totalPages: number): string {
  return (
    "## Lecture Slides\n\n" +
    `The slide deck used in the lecture videos (${totalPages} slides). Read it alongside a video, or use it to review a chapter.\n\n` +
    "### Where each part of the deck starts\n\n" +
    "| Slides | Content |\n" +
    "|---|---|\n" +
    "| 1–3 | Overview of the concepts: how humans learn and how machines learn |\n" +
    "| 4–30 | Chapter 1 — Data Preparation and Model Foundations |\n" +
    "| 31–44 | Chapter 2 — Core Machine Learning Algorithms |\n" +
    `| 45–${totalPages} | Chapter 3 — Model Evaluation and Optimization |\n`
  );
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apply = process.argv.includes("--apply");
  const [slug, pdfPath] = args;
  if (!slug || !pdfPath) {
    console.error("usage: attach-lecture-slides.ts <course-slug> <slides.pdf> [--apply]");
    process.exit(1);
  }

  const buf = await readFile(pdfPath);
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("not a PDF (missing %PDF- header)");
  if (buf.byteLength > MAX_PDF_BYTES) throw new Error(`PDF too large: ${buf.byteLength} > ${MAX_PDF_BYTES}`);
  // Page count from the page tree's /Count, good enough for a label (the field is informational).
  const counts = [...buf.toString("latin1").matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  const totalPages = counts.length ? Math.max(...counts) : undefined;
  if (!totalPages) throw new Error("could not read the page count from the PDF");

  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) throw new Error(`no course ${slug}`);
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error(`course ${slug} has no owner`);

  const existing = await prisma.lesson.findFirst({
    where: { title: LESSON_TITLE, module: { courseId: course.id } },
    select: { id: true },
  });
  if (existing) {
    console.log(`"${LESSON_TITLE}" already exists in ${slug} (${existing.id}) — nothing to do.`);
    return;
  }

  const after = await prisma.lesson.findFirst({
    where: { title: AFTER_TITLE, module: { courseId: course.id } },
    select: { orderIndex: true, moduleId: true, module: { select: { title: true } } },
  });
  if (!after) throw new Error(`no "${AFTER_TITLE}" lesson in ${slug} to insert after`);
  const insertAt = after.orderIndex + 1;

  const toShift = await prisma.lesson.findMany({
    where: { moduleId: after.moduleId, orderIndex: { gte: insertAt } },
    orderBy: { orderIndex: "desc" },
    select: { id: true, orderIndex: true },
  });
  console.log(
    `${apply ? "APPLY" : "DRY RUN"}: ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB, ${totalPages} pages\n` +
      `  insert "${LESSON_TITLE}" at orderIndex ${insertAt} of module "${after.module.title}" (after "${AFTER_TITLE}")\n` +
      `  shift ${toShift.length} later lesson(s) down by one`,
  );
  if (!apply) return;

  for (const l of toShift) {
    await prisma.lesson.update({ where: { id: l.id }, data: { orderIndex: l.orderIndex + 1 } });
  }

  const { lessonId } = await createLesson(
    owner.userId,
    after.moduleId,
    {
      title: LESSON_TITLE,
      orderIndex: insertAt,
      description: `The full slide deck of the course (${totalPages} slides), as one PDF.`,
    },
    prisma,
  );
  await createContentItem(owner.userId, lessonId, { type: "markdown", payload: { body: body(totalPages) }, orderIndex: 0 }, prisma);

  const now = new Date();
  const filename = `${owner.userId}-${now.getTime()}-${randomBytes(8).toString("hex")}.pdf`;
  const key = lessonPdfKey(now, filename);
  await storageFor(key).put(key.key, buf, "application/pdf");
  await createContentItem(
    owner.userId,
    lessonId,
    {
      type: "pdf",
      payload: { url: `/api/lesson-media/pdfs/${filename}`, title: `Lecture Slides (${totalPages} slides)`, totalPages },
      orderIndex: 1,
    },
    prisma,
  );

  console.log(`lesson ${lessonId} created.\nblob: ${key.layer}/${key.key}\nurl:  /api/lesson-media/pdfs/${filename}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
