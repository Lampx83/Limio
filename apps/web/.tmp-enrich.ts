/** Chèn "Study notes" (markdown) + thẻ ghi nhớ (vocab_list) vào từng bài từ file *.notes.json. Idempotent.
 *  node ... .tmp-enrich.ts <slug> <notes.json> [--dry-run]
 *  Vị trí: ngay sau khối đọc đầu tiên của bài (hoặc sau video nếu không có), các khối sau dời xuống. */
import { readFile } from "node:fs/promises";
import { prisma } from "@feedbackme/db";
import { createContentItem } from "@feedbackme/core-lms";
type Card = { term: string; meaning: string; example?: string };
async function main() {
  const [slug, file] = process.argv.slice(2);
  const dry = process.argv.includes("--dry-run");
  const data: Record<string, { title: string; notes: string; flashcards: Card[] }> = JSON.parse(await readFile(file!, "utf8"));
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: slug! } });
  const actor = (await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: course.id, role: "owner" } })).userId;
  let nNotes = 0, nCards = 0;
  for (const [lessonId, e] of Object.entries(data)) {
    const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, module: { courseId: course.id } }, select: { id: true, title: true } });
    if (!lesson) throw new Error(`bài không thuộc khoá: ${lessonId} ${e.title}`);
    const items = await prisma.contentItem.findMany({ where: { lessonId }, orderBy: { orderIndex: "asc" }, select: { id: true, type: true, payload: true, orderIndex: true } });
    const hasNotes = items.some((c) => c.type === "markdown" && String((c.payload as { body?: string }).body ?? "").startsWith("## Study notes"));
    const hasCards = items.some((c) => c.type === "vocab_list" && String((c.payload as { title?: string }).title ?? "").startsWith("Flashcards ·"));
    const add: Array<{ type: "markdown" | "vocab_list"; payload: Record<string, unknown> }> = [];
    if (e.notes?.trim() && !hasNotes) add.push({ type: "markdown", payload: { body: e.notes.trim() } });
    const cards = (e.flashcards ?? []).filter((c) => c.term?.trim() && c.meaning?.trim());
    if (cards.length && !hasCards) add.push({ type: "vocab_list", payload: { title: `Flashcards · ${lesson.title.replace(/^[^·]*·\s*/, "")}`.slice(0, 200), items: cards.map((c) => ({ term: c.term.trim(), meaning: c.meaning.trim(), ...(c.example?.trim() ? { example: c.example.trim() } : {}) })) } });
    if (!add.length) { console.log(`= ${lesson.title}`); continue; }
    const firstRead = items.find((c) => ["markdown", "richtext", "html_block"].includes(c.type) && !String((c.payload as { body?: string }).body ?? "").startsWith("### Practice"));
    const anchor = firstRead ?? items.find((c) => c.type === "video");
    const at = anchor ? anchor.orderIndex + 1 : 0;
    if (dry) { console.log(`(dry) ${lesson.title}: +${add.map((a) => a.type).join(",")} @${at}`); continue; }
    for (const c of [...items].reverse()) if (c.orderIndex >= at) await prisma.contentItem.update({ where: { id: c.id }, data: { orderIndex: c.orderIndex + add.length } });
    for (const [i, a] of add.entries()) await createContentItem(actor, lessonId, { type: a.type, payload: a.payload, orderIndex: at + i }, prisma);
    nNotes += add.filter((a) => a.type === "markdown").length; nCards += add.filter((a) => a.type === "vocab_list").length;
    console.log(`✔ ${lesson.title}: +${add.map((a) => a.type).join(",")}`);
  }
  console.log(`xong: ${nNotes} study notes, ${nCards} flashcard sets`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
