/** Mathematical Foundations: bài tập (3 bộ + cuối kỳ), 3 lab Python, đáp án ẩn, ghi chú thực hành từng Topic. Idempotent. */
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createAssignment, createContentItem, updateContentItem } from "@feedbackme/core-lms";
import { storageFor } from "./src/lib/storage";
import { lessonFileKey } from "./src/lib/storage-keys";
import { lessonFileMimeForFilename } from "./src/lib/lessonFile";
import { ANSWER_KEY, ASSIGNMENTS } from "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/mfds/assignments";

const DIR = "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/mfds";
const dry = process.argv.includes("--dry-run");
const LABS = [
  { part: "Part I materials", file: "MFDS_Lab1_Linear_Algebra.zip", nb: "MFDS_Lab1_Linear_Algebra.ipynb", n: 1, name: "Linear Algebra with NumPy", topics: [1, 2, 3, 4, 5] },
  { part: "Part II materials", file: "MFDS_Lab2_Calculus_Optimization.zip", nb: "MFDS_Lab2_Calculus_Optimization.ipynb", n: 2, name: "Calculus and Optimization", topics: [6, 7, 8, 9] },
  { part: "Part III materials", file: "MFDS_Lab3_Probability_Statistics.zip", nb: "MFDS_Lab3_Probability_Statistics.ipynb", n: 3, name: "Probability and Statistics", topics: [10, 11, 12, 13, 14, 15] },
];

async function main() {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: "mathematical-foundations-for-data-science" } });
  const actor = (await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: course.id, role: "owner" } })).userId;
  const lessons = await prisma.lesson.findMany({ where: { module: { courseId: course.id } }, select: { id: true, title: true } });
  const find = (prefix: string) => { const h = lessons.filter((l) => l.title.startsWith(prefix)); if (h.length !== 1) throw new Error(`"${prefix}": ${h.length}`); return h[0]!; };
  const items = (lessonId: string) => prisma.contentItem.findMany({ where: { lessonId }, select: { id: true, type: true, payload: true, orderIndex: true } });
  const nextOrder = async (lessonId: string) => (await items(lessonId)).reduce((m, c) => Math.max(m, c.orderIndex), -1) + 1;

  async function addFile(lessonId: string, path: string, filename: string, hidden = false) {
    if ((await items(lessonId)).some((c) => c.type === "file" && (c.payload as { filename?: string }).filename === filename)) { console.log(`= ${filename}`); return; }
    const buf = typeof path === "string" && path.startsWith("@") ? Buffer.from(path.slice(1), "utf8") : await readFile(join(DIR, path));
    const mime = lessonFileMimeForFilename(filename); if (!mime) throw new Error(`đuôi không cho phép: ${filename}`);
    if (dry) { console.log(`(dry) ${filename} ${buf.length} B${hidden ? " (ẩn)" : ""}`); return; }
    const now = new Date(); const ext = filename.split(".").pop()!;
    const name = `${actor}-${now.getTime()}-${randomBytes(8).toString("hex")}.${ext}`;
    const key = lessonFileKey(now, name);
    await storageFor(key).put(key.key, buf, mime);
    if (!(await storageFor(key).exists(key.key))) throw new Error(`upload không thấy: ${filename}`);
    const c = await createContentItem(actor, lessonId, { type: "file", payload: { url: `/api/lesson-media/files/${name}`, filename, mimeType: mime, sizeBytes: buf.length }, orderIndex: await nextOrder(lessonId) }, prisma);
    if (hidden) await updateContentItem(actor, c.contentItemId, { isHidden: true }, prisma);
    console.log(`✔ ${filename}${hidden ? " (ẩn)" : ""}`);
  }
  async function addNote(lessonId: string, marker: string, body: string) {
    if ((await items(lessonId)).some((c) => c.type === "markdown" && String((c.payload as { body?: string }).body ?? "").startsWith(marker))) { console.log(`= note ${marker}`); return; }
    if (dry) { console.log(`(dry) note ${marker}`); return; }
    await createContentItem(actor, lessonId, { type: "markdown", payload: { body: `${marker}\n\n${body}` }, orderIndex: await nextOrder(lessonId) }, prisma);
    console.log(`✔ note ${marker}`);
  }

  for (const lab of LABS) {
    const l = find(lab.part);
    await addNote(l.id, `### Python practice — Lab ${lab.n}: ${lab.name}`,
      `Download **\`${lab.file}\`** below and open **\`${lab.nb}\`** in Google Colab (*File → Upload notebook*) or Jupyter. Each section matches one topic of this part and has **Your turn** cells to complete; the **Check** cell under each one tells you when your answer is right. No data files are needed.\n\nThe lab is practice for the topic quizzes and the problem set at the end of this part; it is not graded.`);
    await addFile(l.id, `dist/${lab.file}`, lab.file);
    for (const [i, t] of lab.topics.entries()) {
      const tl = find(`Topic ${t} ·`);
      await addNote(tl.id, "### Practice in Python", `Work through **Section ${i + 1}** of Lab ${lab.n} (*${lab.name}*, \`${lab.nb}\`), attached to the *${lab.part.replace(" materials", "")} materials* lesson at the start of this part.`);
    }
  }
  const overview = find("Course overview");
  await addFile(overview.id, "dist/mfds_labs_solutions.zip", "mfds_labs_solutions.zip", true);
  await addFile(overview.id, "@" + ANSWER_KEY, "mfds_assignment_answer_key.md", true);

  for (const a of ASSIGNMENTS) {
    const l = find(a.lesson);
    if (await prisma.assignment.findFirst({ where: { lessonId: l.id, title: a.title } })) { console.log(`= ${a.title}`); continue; }
    if (dry) { console.log(`(dry) ${l.title} ← ${a.title}`); continue; }
    await createAssignment(actor, l.id, { title: a.title, description: a.description, maxScore: 100, responseFormat: "mixed", rubricText: a.rubric, submissionMode: "individual" }, prisma);
    console.log(`✔ ${l.title} ← ${a.title}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
