/** Data Visualization: dữ liệu thực hành (Course Overview), đáp án giảng viên (ẩn), 10 khối "Practice" theo bài. Idempotent. */
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem, updateContentItem } from "@feedbackme/core-lms";
import { storageFor } from "./src/lib/storage";
import { lessonFileKey } from "./src/lib/storage-keys";
import { lessonFileMimeForFilename } from "./src/lib/lessonFile";
const DIR = "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/dv/data";
const dry = process.argv.includes("--dry-run");
async function main() {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: "data-visualization-for-business-insights" } });
  const actor = (await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: course.id, role: "owner" } })).userId;
  const lessons = await prisma.lesson.findMany({ where: { module: { courseId: course.id } }, select: { id: true, title: true } });
  const find = (p: string) => { const h = lessons.filter((l) => l.title.startsWith(p)); if (h.length !== 1) throw new Error(p); return h[0]!; };
  const items = (lessonId: string) => prisma.contentItem.findMany({ where: { lessonId }, select: { id: true, type: true, payload: true, orderIndex: true } });
  const nextOrder = async (lessonId: string) => (await items(lessonId)).reduce((m, c) => Math.max(m, c.orderIndex), -1) + 1;
  async function addFile(lessonId: string, file: string, hidden = false) {
    if ((await items(lessonId)).some((c) => c.type === "file" && (c.payload as { filename?: string }).filename === file)) { console.log(`= ${file}`); return; }
    const buf = await readFile(join(DIR, file)); const mime = lessonFileMimeForFilename(file); if (!mime) throw new Error(`mime ${file}`);
    if (dry) { console.log(`(dry) ${file} ${buf.length} B ${mime}${hidden ? " ẩn" : ""}`); return; }
    const now = new Date(); const name = `${actor}-${now.getTime()}-${randomBytes(8).toString("hex")}.${file.split(".").pop()}`;
    const key = lessonFileKey(now, name); await storageFor(key).put(key.key, buf, mime);
    if (!(await storageFor(key).exists(key.key))) throw new Error(`upload ${file}`);
    const c = await createContentItem(actor, lessonId, { type: "file", payload: { url: `/api/lesson-media/files/${name}`, filename: file, mimeType: mime, sizeBytes: buf.length }, orderIndex: await nextOrder(lessonId) }, prisma);
    if (hidden) await updateContentItem(actor, c.contentItemId, { isHidden: true }, prisma);
    console.log(`✔ ${file}${hidden ? " (ẩn)" : ""}`);
  }
  async function addNote(lessonId: string, body: string) {
    const marker = body.split("\n")[0]!;
    if ((await items(lessonId)).some((c) => c.type === "markdown" && String((c.payload as { body?: string }).body ?? "").startsWith(marker))) { console.log(`= ${marker}`); return; }
    if (dry) { console.log(`(dry) ${marker}`); return; }
    await createContentItem(actor, lessonId, { type: "markdown", payload: { body }, orderIndex: await nextOrder(lessonId) }, prisma);
    console.log(`✔ ${marker}`);
  }
  const ov = find("Course Overview");
  await addNote(ov.id, "### Practice data\n\nAll Tableau labs in this course use one simulated sales dataset of a fictitious office-supplies retailer (2023–2025, 15 Vietnamese provinces). Download the files below once and keep them in one folder:\n\n- **`Sales_Data.xlsx`**: clean data (Orders, Customer, Product, Targets) for Modules 2–5.\n- **`Sales_Data_Raw.xlsx`**: the same data before cleaning, for the Tableau Prep lab in lesson 2.3.\n- **`data_dictionary.md`**: what every field means.\n\nEach lab gives **Check** values so you can confirm your results.");
  for (const f of ["Sales_Data.xlsx", "Sales_Data_Raw.xlsx", "data_dictionary.md"]) await addFile(ov.id, f);
  await addFile(ov.id, "instructor_key.md", true);
  for (const f of (await readdir(join(DIR, "practice"))).sort()) {
    const l = find(`${f.replace(/\.md$/, "")} ·`);
    await addNote(l.id, await readFile(join(DIR, "practice", f), "utf8"));
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
