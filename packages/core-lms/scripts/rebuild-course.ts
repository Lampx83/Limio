/**
 * Dựng lại MỘT KHOÁ ĐÃ CÓ theo manifest mới, tại chỗ: khớp chương (theo "Chủ đề N ·") và bài (theo tên, hoặc phần trước " · ") với khoá
 * đang có; chương/bài chưa có thì tạo; bài khớp thì xoá khối nội dung cũ và dựng lại; rồi sắp lại thứ tự chương/bài. Giữ nguyên khoá
 * (id, ảnh bìa, học viên ghi danh), chương và bài cũ (id). Khác `refresh-course.ts` ở chỗ biết THÊM bài/chương mới và ĐỔI TÊN/THỨ TỰ.
 *
 *   node --env-file=<env> --import tsx scripts/rebuild-course.ts --file hsk1-v3.json --owner <email> --course <courseId> \
 *        [--assets <dir>] [--subs subs.json] [--backup backup.json] [--prune] [--only "Chủ đề 1 ·|Chủ đề 2 ·"] [--dry-run]
 *
 * - `--subs`: JSON {"@@IMG:mai@@": "/api/lesson-media/images/..."} — thay trong manifest trước khi dựng (chân dung nhân vật).
 * - `--backup`: ghi toàn bộ khối nội dung hiện có của khoá (type, payload, thứ tự) ra file TRƯỚC khi xoá.
 * - `--prune`: xoá bài/chương trên khoá mà manifest không có (mặc định chỉ báo).
 * - Audio hội thoại có cùng người nói + chữ được giữ; lượt mới: chạy fill-dialogue-audio.ts. Audio từ vựng: fill-vocab-audio.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { prisma } from "@feedbackme/db";
import { deleteContentItem } from "../src/courses/contents";
import { createLesson, deleteLesson, reorderLessons, updateLesson } from "../src/courses/lessons";
import { createModule, deleteModule, reorderModules, updateModule } from "../src/courses/modules";
import { updateCourse } from "../src/courses/courses";
import { Manifest, populateLessonContent, resolveManifest, setBookStyle, type PopulateCtx } from "./import-course";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const chapterNo = (t: string) => /^Chủ đề (\d+) ·/.exec(t)?.[1];
const lessonStem = (t: string) => t.split(" · ")[0]!.trim();

async function main() {
  const file = arg("file");
  const ownerEmail = arg("owner");
  const courseId = arg("course");
  const dryRun = process.argv.includes("--dry-run");
  const prune = process.argv.includes("--prune");
  if (!file || !ownerEmail || !courseId) {
    console.error("Dùng: --file <manifest.json> --owner <email> --course <courseId> [--assets <dir>] [--subs <json>] [--backup <json>] [--only \"A|B\"] [--prune] [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const manifestPath = resolveManifest(file);
  let raw = readFileSync(manifestPath, "utf8");
  const subsFile = arg("subs");
  if (subsFile) {
    const subs = JSON.parse(readFileSync(subsFile, "utf8")) as Record<string, string>;
    for (const [k, v] of Object.entries(subs)) raw = raw.split(k).join(v);
  }
  const left = raw.match(/@@IMG:[a-z0-9_-]+@@/g);
  if (left) console.warn(`⚠ Còn ${left.length} chỗ giữ chỗ ảnh chưa được thay: ${[...new Set(left)].join(", ")}`);
  const manifest = Manifest.parse(JSON.parse(raw));
  const assetsDir = resolve(arg("assets") ?? resolve(dirname(manifestPath), "assets"));
  setBookStyle(manifest.course.bookStyle?.accent ?? null);
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);
  const only = arg("only")?.split("|");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      title: true,
      slug: true,
      modules: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, orderIndex: true, lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, orderIndex: true } } } },
    },
  });
  if (!course) throw new Error(`Không thấy khoá ${courseId}`);
  if (course.slug !== manifest.course.slug) throw new Error(`Khoá ${course.slug} khác slug trong manifest (${manifest.course.slug}) — dừng cho chắc.`);
  console.log(`Khoá "${course.title}" (${course.slug}): ${course.modules.length} chương → manifest ${manifest.modules.length} chương.`);

  // ── Sao lưu toàn bộ khối nội dung hiện có ────────────────────────────────────────────
  const backupFile = arg("backup");
  if (backupFile) {
    const all = await prisma.contentItem.findMany({ where: { lesson: { module: { courseId } } }, select: { id: true, lessonId: true, type: true, orderIndex: true, payload: true } });
    writeFileSync(backupFile, JSON.stringify({ course: { id: courseId, title: course.title }, modules: course.modules, items: all }));
    console.log(`✔ Sao lưu ${all.length} khối nội dung → ${backupFile}`);
  }

  // ── Kế hoạch ──────────────────────────────────────────────────────────────────────────
  type Plan = { mi: number; li: number; modTitle: string; lesTitle: string; moduleId?: string; lessonId?: string; spec: (typeof manifest.modules)[number]["lessons"][number] };
  const plans: Plan[] = [];
  const usedModules = new Set<string>();
  const usedLessons = new Set<string>();
  const modMap = new Map<number, string | undefined>();
  for (const [mi, m] of manifest.modules.entries()) {
    const no = chapterNo(m.title);
    const ex = no ? course.modules.find((x) => chapterNo(x.title) === no) : course.modules.find((x) => x.title === m.title);
    if (ex) usedModules.add(ex.id);
    modMap.set(mi, ex?.id);
    for (const [li, l] of m.lessons.entries()) {
      const exL = ex?.lessons.find((x) => x.title === l.title) ?? ex?.lessons.find((x) => lessonStem(x.title) === lessonStem(l.title) && !usedLessons.has(x.id));
      if (exL) usedLessons.add(exL.id);
      plans.push({ mi, li, modTitle: m.title, lesTitle: l.title, moduleId: ex?.id, lessonId: exL?.id, spec: l });
    }
  }
  const selected = plans.filter((p) => !only || only.some((o) => p.modTitle.includes(o) || `${p.modTitle} / ${p.lesTitle}`.includes(o)));
  const orphanModules = course.modules.filter((m) => !usedModules.has(m.id));
  const orphanLessons = course.modules.flatMap((m) => m.lessons.filter((l) => usedModules.has(m.id) && !usedLessons.has(l.id)).map((l) => ({ ...l, mod: m.title })));
  console.log(`Kế hoạch: ${plans.filter((p) => p.lessonId).length} bài khớp (dựng lại), ${plans.filter((p) => !p.lessonId).length} bài tạo mới, ${manifest.modules.filter((_, i) => !modMap.get(i)).length} chương tạo mới.`);
  for (const p of plans.filter((x) => !x.lessonId)) console.log(`  + ${p.modTitle} / ${p.lesTitle}`);
  for (const m of orphanModules) console.log(`  ⚠ Chương không có trong manifest: ${m.title}${prune ? " (SẼ XOÁ)" : " (giữ)"}`);
  for (const l of orphanLessons) console.log(`  ⚠ Bài không có trong manifest: ${l.mod} / ${l.title}${prune ? " (SẼ XOÁ)" : " (giữ)"}`);
  if (dryRun) {
    for (const p of selected.filter((x) => x.lessonId)) {
      const items = await prisma.contentItem.count({ where: { lessonId: p.lessonId } });
      console.log(`  · ${p.modTitle} / ${p.lesTitle}: ${items} khối hiện có sẽ được dựng lại`);
    }
    console.log("\n[dry-run] Không ghi gì.");
    return;
  }

  // ── Khoá: tên + mô tả ────────────────────────────────────────────────────────────────
  await updateCourse(owner.id, courseId, { title: manifest.course.title, description: manifest.course.description });

  // ── Chương: đổi tên / tạo mới ────────────────────────────────────────────────────────
  for (const [mi, m] of manifest.modules.entries()) {
    let id = modMap.get(mi);
    if (id) {
      await updateModule(owner.id, id, { title: m.title });
    } else {
      id = (await createModule(owner.id, courseId, { title: m.title, orderIndex: 1000 + mi })).moduleId;
      modMap.set(mi, id);
      console.log(`  + chương ${m.title}`);
    }
    for (const p of plans.filter((x) => x.mi === mi)) p.moduleId = id;
  }

  // ── Bài: dựng lại / tạo mới ───────────────────────────────────────────────────────────
  const ctx: PopulateCtx = { dialogueCtx: null, dialogueCache: new Map(), dialogueFileCache: new Map(), dialogueTotals: { attached: 0, failed: 0, uploaded: 0, reused: 0 } };
  for (const p of selected) {
    const key = `${p.modTitle} / ${p.lesTitle}`;
    let lessonId = p.lessonId;
    const reuse = new Map<string, string>();
    if (lessonId) {
      const old = await prisma.contentItem.findMany({ where: { lessonId }, select: { id: true, type: true, payload: true } });
      for (const it of old) {
        if (it.type !== "dialogue") continue;
        for (const t of (it.payload as { turns?: Array<{ speaker: string; text: string; audioUrl?: string }> }).turns ?? []) if (t.audioUrl) reuse.set(`${t.speaker}|${t.text}`, t.audioUrl);
      }
      for (const it of old) await deleteContentItem(owner.id, it.id);
      await updateLesson(owner.id, lessonId, {
        title: p.lesTitle,
        description: p.spec.description,
        ...(p.spec.durationMin ? { durationSec: p.spec.durationMin * 60 } : {}),
        ...(p.spec.languageSkill ? { languageSkill: p.spec.languageSkill } : {}),
      });
    } else {
      lessonId = (
        await createLesson(owner.id, p.moduleId!, {
          title: p.lesTitle,
          description: p.spec.description,
          orderIndex: 1000 + p.li,
          ...(p.spec.durationMin ? { durationSec: p.spec.durationMin * 60 } : {}),
          ...(p.spec.languageSkill ? { languageSkill: p.spec.languageSkill } : {}),
        })
      ).lessonId;
      p.lessonId = lessonId;
    }
    ctx.reuseTurnAudio = reuse;
    const before = ctx.dialogueTotals.reused ?? 0;
    await populateLessonContent(owner.id, lessonId, p.spec, assetsDir, ctx);
    console.log(`  ✔ ${key}${p.lessonId && reuse.size ? `: giữ ${(ctx.dialogueTotals.reused ?? 0) - before} audio hội thoại` : ""}`);
  }

  // ── Xoá thừa (nếu --prune) ────────────────────────────────────────────────────────────
  if (prune) {
    for (const l of orphanLessons) await deleteLesson(owner.id, l.id);
    for (const m of orphanModules) await deleteModule(owner.id, m.id);
  }

  // ── Thứ tự bài trong chương, rồi thứ tự chương ────────────────────────────────────────
  const fresh = await prisma.course.findUnique({ where: { id: courseId }, select: { modules: { select: { id: true, lessons: { select: { id: true } } } } } });
  for (const [mi, m] of manifest.modules.entries()) {
    const moduleId = modMap.get(mi)!;
    const ids = plans.filter((x) => x.mi === mi).map((x) => x.lessonId!);
    const rest = (fresh?.modules.find((x) => x.id === moduleId)?.lessons ?? []).map((l) => l.id).filter((id) => !ids.includes(id));
    await reorderLessons(owner.id, moduleId, [...ids, ...rest]);
    void m;
  }
  const orderedModules = manifest.modules.map((_, mi) => modMap.get(mi)!);
  const restModules = (fresh?.modules ?? []).map((m) => m.id).filter((id) => !orderedModules.includes(id));
  await reorderModules(owner.id, courseId, [...orderedModules, ...restModules]);

  console.log("\nXong. Việc còn lại: fill-dialogue-audio.ts (lượt hội thoại mới), fill-vocab-audio.ts (từ vựng), gắn ảnh minh hoạ.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
