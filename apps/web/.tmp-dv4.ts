/** Data Visualization: slide Module 4 (4.2 calculated fields, 4.3 set/group/bins/cluster) + bộ đầy đủ. Idempotent. */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem, updateContentItem } from "@feedbackme/core-lms";
import { storageFor } from "./src/lib/storage";
import { lessonPdfKey } from "./src/lib/storage-keys";
const DIR = "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/dv/pdf";
const PENDING = "> The lecture slides for this lesson are being prepared and will be added here.";
async function main() {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: "data-visualization-for-business-insights" } });
  const actor = (await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: course.id, role: "owner" } })).userId;
  const lessons = await prisma.lesson.findMany({ where: { module: { courseId: course.id } }, select: { id: true, title: true } });
  const find = (p: string) => { const h = lessons.filter((l) => l.title.startsWith(p)); if (h.length !== 1) throw new Error(p); return h[0]!; };
  async function addPdf(lessonId: string, file: string, title: string) {
    const items = await prisma.contentItem.findMany({ where: { lessonId }, select: { type: true, payload: true, orderIndex: true } });
    if (items.some((c) => c.type === "pdf" && (c.payload as { title?: string }).title === title)) { console.log(`= ${title}`); return; }
    const buf = await readFile(join(DIR, file));
    if (buf.subarray(0, 4).toString() !== "%PDF") throw new Error(file);
    const now = new Date();
    const filename = `${actor}-${now.getTime()}-${randomBytes(8).toString("hex")}.pdf`;
    const key = lessonPdfKey(now, filename);
    await storageFor(key).put(key.key, buf, "application/pdf");
    if (!(await storageFor(key).exists(key.key))) throw new Error(`upload ${file}`);
    const next = items.reduce((m, c) => Math.max(m, c.orderIndex), -1) + 1;
    await createContentItem(actor, lessonId, { type: "pdf", payload: { url: `/api/lesson-media/pdfs/${filename}`, title }, orderIndex: next }, prisma);
    console.log(`✔ ${title} (${buf.length} B)`);
  }
  for (const [p, f, t, note] of [
    ["4.2 ·", "m4-2.pdf", "Lecture slides — 4.2 Calculated Fields (PDF)", "The lecture slides for this lesson are below."],
    ["4.3 ·", "m4-3.pdf", "Lecture slides — 4.3 Sets, Groups, Bins and Clusters (PDF)", "The lecture slides for this lesson are below."],
    ["4.1 ·", null, null, "> The lecture slides for advanced chart types will be added here; the Module 4 deck covers calculated fields (lesson 4.2) and sets, groups, bins and clusters (lesson 4.3)."],
  ] as const) {
    const l = find(p);
    if (f && t) await addPdf(l.id, f, t);
    const md = await prisma.contentItem.findFirst({ where: { lessonId: l.id, type: "markdown" }, select: { id: true, payload: true } });
    const body = String((md?.payload as { body?: string })?.body ?? "");
    if (md && body.includes(PENDING)) {
      await updateContentItem(actor, md.id, { payload: { ...(md.payload as object), body: body.replace(PENDING, note) } }, prisma);
      console.log(`✔ ${l.title}: ghi chú slide`);
    }
  }
  const ov = find("Course Overview");
  await addPdf(ov.id, "m4-full.pdf", "Lecture slides — Module 4, full deck (PDF)");
  const all = await prisma.contentItem.findMany({ where: { lessonId: ov.id, type: "pdf" }, select: { id: true, payload: true, orderIndex: true } });
  const decks = [...all].sort((a, b) => String((a.payload as { title: string }).title).localeCompare(String((b.payload as { title: string }).title)));
  const slots = all.map((c) => c.orderIndex).sort((a, b) => a - b);
  for (const [i, d] of decks.entries()) if (d.orderIndex !== slots[i]) await prisma.contentItem.update({ where: { id: d.id }, data: { orderIndex: slots[i]! } });
  const ovMd = await prisma.contentItem.findFirst({ where: { lessonId: ov.id, type: "markdown" }, select: { id: true, payload: true } });
  const b = String((ovMd?.payload as { body?: string })?.body ?? "");
  const old = "The full slide decks for Modules 1, 2, 3 and 5 are below; Module 4 will be added.";
  if (ovMd && b.includes(old)) { await updateContentItem(actor, ovMd.id, { payload: { ...(ovMd.payload as object), body: b.replace(old, "The full slide decks for all five modules are below.") } }, prisma); console.log("✔ Overview text"); }
  const after = await prisma.contentItem.findMany({ where: { lessonId: ov.id, type: "pdf" }, orderBy: { orderIndex: "asc" }, select: { payload: true } });
  console.log(after.map((c) => (c.payload as { title: string }).title));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
