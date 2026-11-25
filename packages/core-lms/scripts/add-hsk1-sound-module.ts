/**
 * Thêm chủ đề 0 "Làm quen âm thanh" (nhập môn phát âm cho người chưa biết tiếng Trung) vào ĐẦU khoá hsk-1-goc.
 * Dữ liệu vào do công cụ ngoài repo sinh (manifest JSON, đã kiểm: thanh của chữ ví dụ khớp audio có sẵn):
 *   { module:{title}, lesson:{title,description}, blocks:[ {type:"richtext"|"vocab_list",payload} | {type:"practice",spec} ] }
 *   tsx scripts/add-hsk1-sound-module.ts <manifest.json> <nhật ký> <email chủ> [--dry-run] [--rollback] [--show]
 * Chủ đề 0 được tạo ở trạng thái ẨN (isHidden) để thầy xem trước; `--show` bật hiển thị cho học viên.
 * Idempotent: chủ đề "Chủ đề 0 ·" đã có thì dùng lại; bài trùng tên thì bỏ qua. Không sửa chủ đề/bài có sẵn ngoài việc dời thứ tự
 * chương (+1). Hoàn tác = `--rollback` (xoá chủ đề 0 theo nhật ký rồi đánh lại thứ tự).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem } from "../src/courses/contents";
import { createLesson } from "../src/courses/lessons";
import { createModule, deleteModule, reorderModules, updateModule } from "../src/courses/modules";
import { importPractice } from "./import-course";

const args = process.argv.slice(2);
const [file, logFile, email] = args.filter((a) => !a.startsWith("--"));
const dry = args.includes("--dry-run");
const rollback = args.includes("--rollback");
const show = args.includes("--show");
if (!file || !logFile || !email) throw new Error("Cần <manifest.json> <nhật ký> <email chủ>");
mkdirSync(dirname(logFile), { recursive: true });

type Block = { type: "richtext" | "vocab_list"; payload: Record<string, unknown> } | { type: "practice"; spec: Record<string, unknown> };
const man = JSON.parse(readFileSync(file, "utf8")) as {
  module: { title: string };
  lesson: { title: string; description?: string; languageSkill?: string | null };
  blocks: Block[];
};

async function main() {
  const actor = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!actor) throw new Error("không có người dùng " + email);
  const course = await prisma.course.findUnique({ where: { slug: "hsk-1-goc" }, select: { id: true } });
  if (!course) throw new Error("không có khoá hsk-1-goc");
  const mods = await prisma.module.findMany({ where: { courseId: course.id }, orderBy: { orderIndex: "asc" }, select: { id: true, title: true, orderIndex: true, isHidden: true } });
  const existing = mods.find((m) => m.title.startsWith("Chủ đề 0 ·"));

  if (rollback) {
    const log = JSON.parse(readFileSync(logFile!, "utf8")) as { moduleId: string };
    await deleteModule(actor.id, log.moduleId);
    const rest = await prisma.module.findMany({ where: { courseId: course.id }, orderBy: { orderIndex: "asc" }, select: { id: true } });
    await reorderModules(actor.id, course.id, rest.map((m) => m.id));
    console.log("đã xoá chủ đề 0 và đánh lại thứ tự", rest.length, "chương");
    await prisma.$disconnect();
    return;
  }

  if (dry) {
    console.log({ chuDe0DaCo: !!existing, soChuongHienCo: mods.length, soKhoiMoi: man.blocks.length, bai: man.lesson.title });
    console.log("DRY-RUN: chưa ghi.");
    await prisma.$disconnect();
    return;
  }

  let moduleId = existing?.id;
  if (!moduleId) {
    const created = await createModule(actor.id, course.id, { title: man.module.title, orderIndex: mods.length });
    moduleId = created.moduleId;
    await reorderModules(actor.id, course.id, [moduleId, ...mods.map((m) => m.id)]);
    await updateModule(actor.id, moduleId, { isHidden: true });
  }
  writeFileSync(logFile!, JSON.stringify({ moduleId }, null, 1));

  const lessons = await prisma.lesson.findMany({ where: { moduleId }, select: { id: true, title: true } });
  if (lessons.some((l) => l.title === man.lesson.title)) {
    console.log("bài đã có, bỏ qua:", man.lesson.title);
  } else {
    const { lessonId } = await createLesson(actor.id, moduleId, { title: man.lesson.title, description: man.lesson.description, orderIndex: lessons.length });
    let idx = 0;
    for (const b of man.blocks) {
      if (b.type === "practice") await importPractice(actor.id, lessonId, b.spec as never, idx, ".");
      else await createContentItem(actor.id, lessonId, { type: b.type, payload: b.payload, orderIndex: idx });
      idx++;
    }
    console.log("đã tạo bài", man.lesson.title, "với", idx, "khối");
  }
  if (show) await updateModule(actor.id, moduleId, { isHidden: false });
  console.log({ moduleId, hidden: !show });
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
