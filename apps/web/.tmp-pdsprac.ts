/** PDS: khối "Practice in Python" cuối mỗi bài + gói notebook (Course Overview) + lời giải (ẩn). Idempotent. */
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem, updateContentItem } from "@feedbackme/core-lms";
import { storageFor } from "./src/lib/storage";
import { lessonFileKey } from "./src/lib/storage-keys";
import { lessonFileMimeForFilename } from "./src/lib/lessonFile";
const DIR = "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/enrich/pdsprac";
async function main() {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: "programming-for-data-science" } });
  const actor = (await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: course.id, role: "owner" } })).userId;
  const items = (lessonId: string) => prisma.contentItem.findMany({ where: { lessonId }, select: { id: true, type: true, payload: true, orderIndex: true } });
  const next = async (lessonId: string) => (await items(lessonId)).reduce((m, c) => Math.max(m, c.orderIndex), -1) + 1;
  for (const f of (await readdir(join(DIR, "practice"))).sort()) {
    const lessonId = f.replace(/\.md$/, "");
    const l = await prisma.lesson.findFirstOrThrow({ where: { id: lessonId, module: { courseId: course.id } }, select: { title: true } });
    if ((await items(lessonId)).some((c) => c.type === "markdown" && String((c.payload as { body?: string }).body ?? "").startsWith("### Practice in Python"))) { console.log(`= ${l.title}`); continue; }
    await createContentItem(actor, lessonId, { type: "markdown", payload: { body: await readFile(join(DIR, "practice", f), "utf8") }, orderIndex: await next(lessonId) }, prisma);
    console.log(`✔ ${l.title}`);
  }
  const ov = await prisma.lesson.findFirstOrThrow({ where: { module: { courseId: course.id }, title: "Course Overview" }, select: { id: true } });
  for (const [file, hidden] of [["PDS_practice_notebooks.zip", false], ["PDS_practice_solutions.zip", true]] as const) {
    if ((await items(ov.id)).some((c) => c.type === "file" && (c.payload as { filename?: string }).filename === file)) { console.log(`= ${file}`); continue; }
    const buf = await readFile(join(DIR, file)); const mime = lessonFileMimeForFilename(file)!;
    const now = new Date(); const name = `${actor}-${now.getTime()}-${randomBytes(8).toString("hex")}.zip`;
    const key = lessonFileKey(now, name); await storageFor(key).put(key.key, buf, mime);
    if (!(await storageFor(key).exists(key.key))) throw new Error(file);
    const c = await createContentItem(actor, ov.id, { type: "file", payload: { url: `/api/lesson-media/files/${name}`, filename: file, mimeType: mime, sizeBytes: buf.length }, orderIndex: await next(ov.id) }, prisma);
    if (hidden) await updateContentItem(actor, c.contentItemId, { isHidden: true }, prisma);
    console.log(`✔ ${file}${hidden ? " (ẩn)" : ""}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
