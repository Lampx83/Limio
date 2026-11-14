/**
 * Làm mới TỪNG BÀI của một khoá ĐÃ CÓ từ file học liệu, tại chỗ: giữ nguyên khoá (id, ảnh bìa, banner, chương, học viên ghi danh, tiến độ
 * theo bài), chỉ xoá và dựng lại khối nội dung của những bài được chọn. Khác `import-course.ts --replace` (xoá cả khoá, đổi id, mất
 * mọi chỉnh sửa tay) và `update-lesson.ts` (chỉ khối chữ và câu hỏi; không biết Bài luyện, hội thoại, khối audio).
 *
 *   node --env-file=../db/.env.prod-import --import tsx scripts/refresh-course.ts --file hsk3-lessons-1-8.json --owner <email> \
 *        --course <courseId> --assets <thư-mục-assets> [--since hsk3-cu.json] [--only "Lesson 2 · |Lesson 3 ·"] [--dry-run]
 *
 * - `--since <manifest cũ>`: chỉ làm mới bài có nội dung khác bản cũ (sửa gì làm mới đó).
 * - `--only "A|B"`: chỉ bài có khoá "chương / bài" chứa một trong các chuỗi.
 * - Bài có trong file nhưng chưa có trên khoá thì chỉ được báo (thêm bài mới: dùng `import-course.ts --into`).
 * - Audio NEU của lượt hội thoại có cùng người nói + chữ được GIỮ; lượt mới hoặc đổi chữ chưa có audio: chạy `fill-dialogue-audio.ts`.
 * - Khối do giáo viên thêm tay vào bài (ghi chú, tệp…) cũng bị dựng lại: script đếm và báo trước khi xoá.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { prisma } from "@feedbackme/db";
import { deleteContentItem } from "../src/courses/contents";
import { updateLesson } from "../src/courses/lessons";
import { setCourseProtectedMedia } from "../src/courses/protectedMedia";
import { Manifest, populateLessonContent, resolveManifest, setBookStyle, type PopulateCtx } from "./import-course";
import { lessonKey, selectLessons, stableStringify, type LessonRef } from "./refresh-select";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Spec = ReturnType<typeof Manifest.parse>["modules"][number]["lessons"][number];

function refsOf(m: ReturnType<typeof Manifest.parse>): LessonRef<Spec>[] {
  return m.modules.flatMap((mod) => mod.lessons.map((l) => ({ moduleTitle: mod.title, lessonTitle: l.title, spec: l })));
}

async function main() {
  const file = arg("file");
  const ownerEmail = arg("owner");
  const courseId = arg("course");
  const dryRun = process.argv.includes("--dry-run");
  if (!file || !ownerEmail || !courseId) {
    console.error("Dùng: --file <manifest.json> --owner <email> --course <courseId> [--assets <thư-mục>] [--since <manifest-cũ.json>] [--only \"A|B\"] [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const manifestPath = resolveManifest(file);
  const manifest = Manifest.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
  const assetsDir = resolve(arg("assets") ?? resolve(dirname(manifestPath), "assets"));
  // Phong cách sách của khoá (:::folio, :::box, dải tên bài…): phải bật TRƯỚC khi dựng, như import-course.ts, nếu không các chỉ thị hiện thành chữ thô.
  setBookStyle(manifest.course.bookStyle?.accent ?? null);
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);

  let since: Map<string, string> | undefined;
  const sinceFile = arg("since");
  if (sinceFile) {
    const old = Manifest.parse(JSON.parse(readFileSync(resolveManifest(sinceFile), "utf8")));
    since = new Map(refsOf(old).map((r) => [lessonKey(r.moduleTitle, r.lessonTitle), stableStringify(r.spec)]));
  }
  const only = arg("only")?.split("|");
  const selected = selectLessons(refsOf(manifest), { since, only });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, modules: { select: { title: true, lessons: { select: { id: true, title: true } } } } },
  });
  if (!course) throw new Error(`Không thấy khoá ${courseId}`);
  console.log(`Khoá "${course.title}": ${selected.length}/${refsOf(manifest).length} bài được chọn để làm mới.`);

  const targets: Array<{ ref: LessonRef<Spec>; lessonId: string }> = [];
  for (const ref of selected) {
    const lessonId = course.modules.find((m) => m.title === ref.moduleTitle)?.lessons.find((x) => x.title === ref.lessonTitle)?.id;
    if (!lessonId) console.warn(`⚠ Chưa có trên khoá: ${lessonKey(ref.moduleTitle, ref.lessonTitle)} (bỏ qua; thêm bài mới dùng import-course.ts --into)`);
    else targets.push({ ref, lessonId });
  }

  let problems = 0;
  for (const { ref, lessonId } of targets) {
    const key = lessonKey(ref.moduleTitle, ref.lessonTitle);
    const items = await prisma.contentItem.findMany({ where: { lessonId }, select: { id: true, type: true } });
    const kinds = new Map<string, number>();
    for (const it of items) kinds.set(it.type, (kinds.get(it.type) ?? 0) + 1);
    const extra = await prisma.assignment.count({ where: { lessonId } });
    console.log(`  · ${key}: ${items.length} khối hiện có (${[...kinds].map(([k, n]) => `${k}×${n}`).join(", ")})` + (extra ? `, ${extra} bài tập nộp được GIỮ nguyên` : ""));
    for (const a of ref.spec.audios ?? []) if (!existsSync(resolve(assetsDir, a.audio))) { console.error(`✗ ${key}: thiếu audio ${a.audio}`); problems++; }
    for (const d of ref.spec.dialogues ?? []) for (const t of d.turns) if (t.audio && !existsSync(resolve(assetsDir, t.audio))) { console.error(`✗ ${key}: thiếu audio ${t.audio}`); problems++; }
  }
  if (problems) {
    process.exitCode = 1;
    return;
  }
  if (dryRun || targets.length === 0) {
    console.log(dryRun ? "\n[dry-run] Không ghi gì." : "\nKhông có bài nào cần làm mới.");
    return;
  }

  const ctx: PopulateCtx = {
    dialogueCtx: null, // audio mới sinh riêng bằng fill-dialogue-audio.ts; ở đây chỉ giữ audio cũ của lượt không đổi
    dialogueCache: new Map(),
    dialogueFileCache: new Map(),
    dialogueTotals: { attached: 0, failed: 0, uploaded: 0, reused: 0 },
  };
  for (const { ref, lessonId } of targets) {
    const key = lessonKey(ref.moduleTitle, ref.lessonTitle);
    const old = await prisma.contentItem.findMany({ where: { lessonId }, select: { id: true, type: true, payload: true } });
    const reuse = new Map<string, string>();
    for (const it of old) {
      if (it.type !== "dialogue") continue;
      for (const t of (it.payload as { turns?: Array<{ speaker: string; text: string; audioUrl?: string }> }).turns ?? []) {
        if (t.audioUrl) reuse.set(`${t.speaker}|${t.text}`, t.audioUrl);
      }
    }
    for (const it of old) await deleteContentItem(owner.id, it.id);
    await updateLesson(owner.id, lessonId, {
      description: ref.spec.description,
      ...(ref.spec.durationMin ? { durationSec: ref.spec.durationMin * 60 } : {}),
      ...(ref.spec.languageSkill ? { languageSkill: ref.spec.languageSkill } : {}),
    });
    ctx.reuseTurnAudio = reuse;
    const before = ctx.dialogueTotals.reused ?? 0;
    await populateLessonContent(owner.id, lessonId, ref.spec, assetsDir, ctx);
    const now = await prisma.contentItem.findMany({ where: { lessonId, type: "dialogue" }, select: { payload: true } });
    const missing = now.reduce((n, it) => n + ((it.payload as { turns?: Array<{ audioUrl?: string }> }).turns ?? []).filter((t) => !t.audioUrl).length, 0);
    console.log(`  ✔ ${key}: dựng lại, giữ ${(ctx.dialogueTotals.reused ?? 0) - before} audio hội thoại cũ` + (missing ? `, ${missing} lượt chưa có audio` : ""));
  }
  if (manifest.course.protectedMedia) {
    const r = await setCourseProtectedMedia(owner.id, courseId, true);
    console.log(`✔ Học liệu có bản quyền: đã bảo vệ ${r.files} file học liệu bài học.`);
  }
  console.log("\nXong. Nếu còn lượt hội thoại chưa có audio: chạy fill-dialogue-audio.ts (hoặc bước `audio` của script nhập prod).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
