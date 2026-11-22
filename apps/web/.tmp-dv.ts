/** Dựng khoá Data Visualization in Business (MICRO4ASIA 04). Idempotent theo slug / tiêu đề module, bài, khối. */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createAssignment, createContentItem, createCourse, createLesson, createModule, publishCourse, updateCourse } from "@feedbackme/core-lms";
import { storageFor } from "./src/lib/storage";
import { lessonPdfKey } from "./src/lib/storage-keys";
import { ASSIGNMENTS, LO, MODULES, OVERVIEW } from "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/dv/content";

const DIR = "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/dv";
const SLUG = "data-visualization-for-business-insights";
const dry = process.argv.includes("--dry-run");
const publish = process.argv.includes("--publish");

async function upload(file: string, actor: string) {
  const buf = await readFile(join(DIR, "pdf", file));
  if (buf.subarray(0, 4).toString() !== "%PDF") throw new Error(`not a PDF: ${file}`);
  const now = new Date();
  const filename = `${actor}-${now.getTime()}-${randomBytes(8).toString("hex")}.pdf`;
  const key = lessonPdfKey(now, filename);
  await storageFor(key).put(key.key, buf, "application/pdf");
  if (!(await storageFor(key).exists(key.key))) throw new Error(`upload not visible: ${file}`);
  return `/api/lesson-media/pdfs/${filename}`;
}

async function ensureModule(actor: string, courseId: string, title: string, orderIndex: number) {
  const m = await prisma.module.findFirst({ where: { courseId, title } });
  if (m) return m.id;
  const { moduleId } = await createModule(actor, courseId, { title, orderIndex }, prisma);
  console.log(`✔ module ${title}`);
  return moduleId;
}
async function ensureLesson(actor: string, moduleId: string, title: string, orderIndex: number, description: string) {
  const l = await prisma.lesson.findFirst({ where: { moduleId, title } });
  if (l) return { id: l.id, created: false };
  const { lessonId } = await createLesson(actor, moduleId, { title, orderIndex, description }, prisma);
  console.log(`  ✔ lesson ${title}`);
  return { id: lessonId, created: true };
}
async function addBlock(actor: string, lessonId: string, type: "markdown" | "pdf", payload: Record<string, unknown>, file?: string) {
  const items = await prisma.contentItem.findMany({ where: { lessonId }, select: { type: true, payload: true, orderIndex: true } });
  const same = items.find((c) => c.type === type && (type === "pdf" ? (c.payload as { title?: string }).title === payload.title : true));
  if (same) return;
  if (file) payload = { ...payload, url: await upload(file, actor) };
  const next = items.reduce((m, c) => Math.max(m, c.orderIndex), -1) + 1;
  await createContentItem(actor, lessonId, { type, payload, orderIndex: next }, prisma);
  console.log(`    ✔ ${type}${file ? ` ← ${file}` : ""}`);
}

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "lampx@neu.edu.vn" }, select: { id: true } });
  const actor = owner.id;
  let course = await prisma.course.findUnique({ where: { slug: SLUG } });
  if (dry) {
    console.log(course ? `= course có sẵn ${course.id}` : "(dry) sẽ tạo course");
    for (const m of MODULES) console.log(m.title, m.lessons.map((l) => `${l.title}${l.slides ? " [pdf]" : ""}`));
    return;
  }
  if (!course) {
    const { courseId } = await createCourse(actor, {
      title: "Data Visualization in Business",
      slug: SLUG,
      description:
        "Learn to organize, prepare, analyze, visualize and communicate business data with Tableau. The course moves from data types, design principles and chart selection to connecting and preparing data with Tableau Prep, building basic and advanced charts, using calculations and LOD expressions, and designing interactive dashboards and data stories.\n\nThrough business examples and an integrated project, you practise turning business questions into clear visual evidence and communicating insights that support decisions. A micro-credential of the College of Technology, National Economics University, developed under the MICRO4ASIA project.",
      language: "en",
      level: "beginner",
      category: "Data Science",
      personalizationEnabled: true,
    }, prisma);
    course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    console.log(`✔ course ${courseId}`);
  }
  await updateCourse(actor, course.id, { authors: "Nguyễn Phương Hạnh", publicAccess: true, personalizationEnabled: true }, prisma);
  await prisma.course.update({ where: { id: course.id }, data: { certificateMinCompletionPct: 90 } });

  const start = await ensureModule(actor, course.id, "Start here", 0);
  const syl = await ensureLesson(actor, start, "Course Syllabus", 0, "The official course syllabus: aim, learning outcomes, assessment and the 15-session teaching plan.");
  await addBlock(actor, syl.id, "markdown", { body: await readFile(join(DIR, "syllabus.md"), "utf8") });
  const ov = await ensureLesson(actor, start, "Course Overview", 1, "What the course covers, the tools you need and how you are assessed.");
  await addBlock(actor, ov.id, "markdown", { body: OVERVIEW });
  for (const [i, f] of [[1, "m1-full.pdf"], [3, "m3-full.pdf"], [5, "m5-full.pdf"]] as const)
    await addBlock(actor, ov.id, "pdf", { title: `Lecture slides — Module ${i}, full deck (PDF)` }, f);

  for (const [mi, m] of MODULES.entries()) {
    const mid = await ensureModule(actor, course.id, m.title, mi + 1);
    for (const [li, l] of m.lessons.entries()) {
      const { id } = await ensureLesson(actor, mid, l.title, li, l.description);
      const last = li === m.lessons.length - 1;
      const body = [
        "## In this lesson",
        l.content,
        "",
        "**Learning outcomes**",
        ...l.los.map((c) => `- **${c}**: ${LO[c]}`),
        "",
        l.slides ? "The lecture slides for this lesson are below." : "> The lecture slides for this lesson are being prepared and will be added here.",
        ...(last ? ["", `### Practice for ${m.title.split(" — ")[0]}`, m.practice] : []),
      ].join("\n");
      await addBlock(actor, id, "markdown", { body });
      if (l.slides) await addBlock(actor, id, "pdf", { title: l.slides.title }, l.slides.file);
    }
  }

  for (const a of ASSIGNMENTS) {
    const l = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId: course.id }, title: { startsWith: a.lesson } }, select: { id: true, title: true } });
    if (await prisma.assignment.findFirst({ where: { lessonId: l.id, title: a.title } })) continue;
    await createAssignment(actor, l.id, { title: a.title, description: a.description, maxScore: 100, responseFormat: "mixed", rubricText: a.rubric, submissionMode: "individual" }, prisma);
    console.log(`✔ assignment ${a.title}`);
  }
  if (publish && course.status !== "published") { await publishCourse(actor, course.id, prisma); console.log("✔ published"); }
  const c = await prisma.course.findUniqueOrThrow({ where: { id: course.id }, select: { status: true, publicAccess: true, certificateMinCompletionPct: true, authors: true, personalizationEnabled: true } });
  console.log(c);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
