/** Xuất từng bài (tiêu đề, mô tả, nội dung đọc hiện có, lời giảng từ VTT, câu quiz) của 4 khoá cần bổ sung ghi chú. */
import { writeFile } from "node:fs/promises";
import { prisma } from "@feedbackme/db";
import { storageFor } from "./src/lib/storage";
import { lessonTranscriptKeyFromFilename } from "./src/lib/storage-keys";
const OUT = "/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/cf11ca4c-5d88-4a04-829e-381282b2c275/scratchpad/enrich";
const SLUGS = ["data-cleaning-and-preprocessing-with-python", "fundamental-of-machine-learning", "programming-for-data-science", "data-visualization-for-business-insights"];
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
async function vtt(url: string) {
  const fn = url.split("/").pop()!;
  const key = lessonTranscriptKeyFromFilename(fn);
  if (!key) return "";
  const buf = await storageFor(key).get(key.key).catch(() => null);
  if (!buf) return "";
  const s = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf);
  return s.split(/\r?\n/).filter((l) => l && !/^WEBVTT|-->|^\d+$|^NOTE/.test(l)).join(" ").replace(/\s+/g, " ");
}
async function main() {
  for (const slug of SLUGS) {
    const c = await prisma.course.findUniqueOrThrow({ where: { slug }, select: { id: true, title: true } });
    const mods = await prisma.module.findMany({ where: { courseId: c.id, isHidden: false }, orderBy: { orderIndex: "asc" }, include: { lessons: { where: { isHidden: false }, orderBy: { orderIndex: "asc" }, include: { contentItems: { where: { isHidden: false }, orderBy: { orderIndex: "asc" } } } } } });
    const lessons = [];
    for (const m of mods) for (const l of m.lessons) {
      const items = l.contentItems;
      let transcript = "";
      for (const it of items.filter((i) => i.type === "video")) { const u = (it.payload as { transcriptUrl?: string }).transcriptUrl; if (u) transcript += (await vtt(u)) + "\n"; }
      const reading = items.filter((i) => ["markdown", "richtext", "html_block"].includes(i.type)).map((i) => { const p = i.payload as { body?: string; html?: string }; return p.body ?? strip(p.html ?? ""); }).join("\n\n");
      const qs = await prisma.quizQuestion.findMany({ where: { quiz: { lessonId: l.id } }, select: { prompt: true } });
      lessons.push({ lessonId: l.id, module: m.title, title: l.title, description: l.description, types: items.map((i) => i.type), readingChars: reading.length, reading, transcript: transcript.trim(), quizPrompts: qs.map((q) => (typeof q.prompt === "string" ? q.prompt : JSON.stringify(q.prompt)).slice(0, 200)) });
    }
    await writeFile(`${OUT}/${slug}.json`, JSON.stringify({ course: c.title, slug, lessons }, null, 1));
    console.log(slug, lessons.length, "lessons,", lessons.filter((x) => x.transcript).length, "with transcript,", Math.round(lessons.reduce((s, x) => s + x.transcript.length, 0) / 1000), "k chars transcript");
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
