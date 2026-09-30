/**
 * Add the official syllabus to a course as its first lesson.
 *
 *   tsx scripts/seed-syllabus.ts <pds|ml> <path-to-syllabus.pdf> [--dry-run]
 *
 * Creates "Đề cương học phần" as the first lesson of the first module: a
 * Vietnamese rendering of the official syllabus (scripts/content/syllabus/*.md)
 * with a table mapping each module of the syllabus to what is on the platform,
 * followed by the original PDF so learners can download the source document.
 *
 * The Vietnamese text is a faithful rendering of the PDF (general information,
 * description, learning outcomes, outline, teaching method, assessment,
 * required literature). Anything that is not in the PDF — weekly plan, outcome
 * codes, rubrics — is deliberately not invented here.
 *
 * Idempotent: a lesson with that title is skipped. The PDF is uploaded before
 * any row is created, so a failed transfer cannot leave a half-built lesson.
 */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createLesson, createContentItem, createSkill, tagLessonSkill } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonPdfKey } from "../src/lib/storage-keys";

const PLANS = {
  pds: {
    slug: "programming-for-data-science",
    file: "pds.md",
    pdfTitle: "Đề cương gốc (PDF, tiếng Anh)",
    skill: {
      code: "pds.intro.syllabus",
      name: "Nắm mục tiêu, nội dung và cách đánh giá của học phần",
      description:
        "Biết học phần Programming for Data Science dạy gì, đánh giá ra sao và dùng tài liệu nào.",
    },
  },
  ml: {
    slug: "fundamental-of-machine-learning",
    file: "ml.md",
    pdfTitle: "Đề cương gốc (PDF, tiếng Anh)",
    skill: {
      code: "ml.intro.syllabus",
      name: "Nắm mục tiêu, nội dung và cách đánh giá của học phần",
      description:
        "Biết học phần Fundamental of Machine Learning dạy gì, đánh giá ra sao và dùng tài liệu nào.",
    },
  },
} as const;

const LESSON_TITLE = "Đề cương học phần";
const LESSON_DESCRIPTION =
  "Mục tiêu, chuẩn đầu ra, nội dung, phương pháp giảng dạy, đánh giá và tài liệu của học phần, kèm đề cương gốc để tải về.";

async function main() {
  const which = process.argv[2];
  const pdfPath = process.argv[3];
  const dryRun = process.argv.includes("--dry-run");
  if ((which !== "pds" && which !== "ml") || !pdfPath || pdfPath.startsWith("--")) {
    console.error("usage: seed-syllabus.ts <pds|ml> <syllabus.pdf> [--dry-run]");
    process.exit(1);
  }
  const plan = PLANS[which];
  const body = readFileSync(join(__dirname, "content", "syllabus", plan.file), "utf8").trimEnd();
  if (body.length < 2500) throw new Error(`${plan.file} looks too short (${body.length} chars)`);

  const pdf = await readFile(pdfPath);
  if (pdf.byteLength === 0 || pdf.subarray(0, 4).toString() !== "%PDF") {
    throw new Error(`${pdfPath} is not a PDF`);
  }

  const course = await prisma.course.findUnique({ where: { slug: plan.slug } });
  if (!course) throw new Error(`no course ${plan.slug}`);
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error("course has no owner");
  const mod = await prisma.module.findFirst({ where: { courseId: course.id }, orderBy: { orderIndex: "asc" } });
  if (!mod) throw new Error("course has no module");

  const existing = await prisma.lesson.findFirst({ where: { moduleId: mod.id, title: LESSON_TITLE } });
  if (existing) {
    console.log(`skip (already built): ${LESSON_TITLE}`);
    return;
  }

  if (dryRun) {
    console.log(`DRY RUN\n"${LESSON_TITLE}" -> ${mod.title} [first]  reading ${body.length} chars  + PDF ${(pdf.byteLength / 1024).toFixed(0)} KB`);
    return;
  }

  // Upload first: if the transfer dies, the worst case is an orphan blob.
  const now = new Date();
  const filename = `${owner.userId}-${now.getTime()}-${randomBytes(8).toString("hex")}.pdf`;
  const key = lessonPdfKey(now, filename);
  await storageFor(key).put(key.key, pdf, "application/pdf");
  const url = `/api/lesson-media/pdfs/${filename}`;

  // Make room at the top: shift existing lessons down one if slot 0 is taken.
  const occupied = await prisma.lesson.findFirst({ where: { moduleId: mod.id, orderIndex: 0 }, select: { id: true } });
  if (occupied) {
    const siblings = await prisma.lesson.findMany({
      where: { moduleId: mod.id },
      orderBy: { orderIndex: "desc" },
      select: { id: true, orderIndex: true },
    });
    for (const s of siblings) {
      await prisma.lesson.update({ where: { id: s.id }, data: { orderIndex: s.orderIndex + 1 } });
    }
  }

  const { lessonId } = await createLesson(
    owner.userId,
    mod.id,
    { title: LESSON_TITLE, orderIndex: 0, description: LESSON_DESCRIPTION },
    prisma,
  );
  await createContentItem(owner.userId, lessonId, { type: "markdown", payload: { body }, orderIndex: 0 }, prisma);
  await createContentItem(
    owner.userId,
    lessonId,
    { type: "pdf", payload: { url, title: plan.pdfTitle }, orderIndex: 1 },
    prisma,
  );

  const found = await prisma.skill.findUnique({ where: { code: plan.skill.code } });
  const skillId = found?.id ?? (await createSkill(plan.skill, prisma)).skillId;
  await tagLessonSkill(owner.userId, lessonId, { skillId }, prisma);

  console.log(`"${LESSON_TITLE}" — reading ${body.length} chars, PDF ${(pdf.byteLength / 1024).toFixed(0)} KB -> ${url}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
