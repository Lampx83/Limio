/**
 * Đưa video giảng viên nói (Ditto) vào Limio, hai bước quanh script dựng `build-lecturer-video.ts` (docs/tieu-chi/trinh-chieu-giang-vien.md, AC7):
 *
 *   tsx scripts/lecturer-video.ts export --course <slug> --out <thư mục việc> [--lesson <id>]
 *       Chép giọng + mốc đoạn của các bài đã có giọng ra thư mục việc (chỉ ĐỌC, không ghi DB/kho).
 *   tsx scripts/lecturer-video.ts attach --dir <thư mục việc> --lecturer <mã> [--lesson <id>] [--apply]
 *       Nạp video đã dựng vào kho tệp và bài. Mặc định chỉ in kế hoạch; ghi khi có --apply.
 *
 * `attach` idempotent: bài đã nạp đúng bản này thì bỏ qua; từ chối bài mà giọng đã tạo lại sau lúc export (video sẽ lệch tiếng);
 * bản video cũ bị thay thì tệp cũ được xoá khỏi kho. Mã giảng viên (`tien-dat`…) phải là giảng viên ảo có trong danh mục, và
 * video chỉ phát khi học viên đang học với đúng giảng viên đó.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prisma } from "@feedbackme/db";
import { attributeNarrationFile, findVirtualLecturer, isLearnerVisible, saveLecturerVideo } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonLecturerVideoKey } from "../src/lib/storage-keys";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function exportLessons() {
  const slug = arg("course");
  const out = arg("out");
  if (!slug || !out) throw new Error("usage: export --course <slug> --out <thư mục>");
  const only = arg("lesson");
  const rows = await prisma.lessonNarration.findMany({
    where: { kind: "lecture", ...(only ? { lessonId: only } : {}), lesson: { module: { course: { slug } } } },
    include: { lesson: { select: { title: true, orderIndex: true, module: { select: { orderIndex: true } } } } },
  });
  rows.sort((a, b) => a.lesson.module.orderIndex - b.lesson.module.orderIndex || a.lesson.orderIndex - b.lesson.orderIndex);
  let n = 0;
  for (const r of rows) {
    if (!isLearnerVisible(r) || !r.audioKey || r.durationSec == null || !r.segments) {
      console.log(`• ${r.lesson.title}: chưa có giọng khớp kịch bản, bỏ qua`);
      continue;
    }
    const dir = join(resolve(out), r.lessonId);
    await mkdir(dir, { recursive: true });
    const segs = (r.segments as unknown as Array<{ anchor: string; startSec: number; endSec: number }>).map(({ anchor, startSec, endSec }) => ({ anchor, startSec, endSec }));
    await writeFile(join(dir, "audio.mp3"), await storageFor({ layer: "private", key: r.audioKey }).get(r.audioKey));
    await writeFile(join(dir, "segments.json"), JSON.stringify(segs));
    await writeFile(join(dir, "meta.json"), JSON.stringify({ lessonId: r.lessonId, title: r.lesson.title, durationSec: r.durationSec, generatedHash: r.generatedHash }));
    console.log(`• ${r.lesson.title}: ${segs.length} đoạn, ${r.durationSec.toFixed(0)} giây`);
    n++;
  }
  console.log(`Đã chép ${n} bài vào ${resolve(out)}.`);
}

async function attach() {
  const dir = arg("dir");
  const lecturer = arg("lecturer");
  const apply = flag("apply");
  if (!dir || !lecturer) throw new Error("usage: attach --dir <thư mục việc> --lecturer <mã> [--lesson <id>] [--apply]");
  if (!findVirtualLecturer(lecturer)) throw new Error(`Mã giảng viên ảo không có trong danh mục: ${lecturer}`);
  const only = arg("lesson");
  const ids = (await readdir(resolve(dir), { withFileTypes: true }))
    .filter((e) => e.isDirectory() && (!only || e.name === only) && existsSync(join(resolve(dir), e.name, "video.json")))
    .map((e) => e.name);
  if (!ids.length) throw new Error("Không có bài nào đã dựng (thiếu <id>/video.json).");

  const tally = { attached: 0, skipped: 0, refused: 0 };
  for (const id of ids) {
    const base = join(resolve(dir), id);
    const meta = JSON.parse(await readFile(join(base, "meta.json"), "utf8")) as { title?: string; durationSec: number; generatedHash: string };
    const built = JSON.parse(await readFile(join(base, "video.json"), "utf8")) as { renditions: { lg: { file: string; bytes: number }; sm: { file: string; bytes: number } } };
    const label = meta.title ?? id;
    const row = await prisma.lessonNarration.findUnique({ where: { lessonId_kind: { lessonId: id, kind: "lecture" } } });
    if (!row || !isLearnerVisible(row)) {
      console.log(`• ${label}: bài chưa có giọng — bỏ qua`);
      tally.refused++;
      continue;
    }
    if (row.generatedHash !== meta.generatedHash || Math.abs((row.durationSec ?? 0) - meta.durationSec) > 0.05) {
      console.log(`• ${label}: giọng đã tạo lại sau lúc export — TỪ CHỐI (video sẽ lệch tiếng). Export và dựng lại.`);
      tally.refused++;
      continue;
    }
    if (row.videoForHash === row.generatedHash && row.videoLecturer === lecturer && row.videoSizeBytes === built.renditions.lg.bytes && row.videoSmSizeBytes === built.renditions.sm.bytes) {
      console.log(`• ${label}: đã nạp đúng bản này — bỏ qua`);
      tally.skipped++;
      continue;
    }
    const mb = (b: number) => (b / 1e6).toFixed(1);
    console.log(`• ${label}: ${apply ? "nạp" : "sẽ nạp"} lg ${mb(built.renditions.lg.bytes)} MB + sm ${mb(built.renditions.sm.bytes)} MB cho ${lecturer}${row.videoKey ? " (thay bản cũ)" : ""}`);
    if (!apply) continue;

    const stamp = `${Date.now()}-${randomBytes(6).toString("hex")}`;
    const lgKey = lessonLecturerVideoKey(id, `lecturer-${stamp}-lg.mp4`);
    const smKey = lessonLecturerVideoKey(id, `lecturer-${stamp}-sm.mp4`);
    await storageFor(lgKey).put(lgKey.key, await readFile(join(base, built.renditions.lg.file)), "video/mp4");
    await storageFor(smKey).put(smKey.key, await readFile(join(base, built.renditions.sm.file)), "video/mp4");
    try {
      const { previousKeys } = await saveLecturerVideo(id, {
        key: lgKey.key,
        smKey: smKey.key,
        sizeBytes: built.renditions.lg.bytes,
        smSizeBytes: built.renditions.sm.bytes,
        forHash: meta.generatedHash,
        lecturer,
      });
      await attributeNarrationFile(id, lgKey.layer, lgKey.key);
      await attributeNarrationFile(id, smKey.layer, smKey.key);
      for (const k of previousKeys) await storageFor({ layer: "private", key: k }).delete(k).catch(() => {});
      tally.attached++;
    } catch (e) {
      // Không để tệp mồ côi trong kho khi DB từ chối.
      await storageFor(lgKey).delete(lgKey.key).catch(() => {});
      await storageFor(smKey).delete(smKey.key).catch(() => {});
      throw e;
    }
  }
  console.log(`${apply ? "Xong" : "Dry run"}: nạp ${tally.attached}, bỏ qua ${tally.skipped}, từ chối ${tally.refused}.${apply ? "" : " Thêm --apply để ghi."}`);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "export") await exportLessons();
  else if (cmd === "attach") await attach();
  else throw new Error("usage: lecturer-video.ts export|attach …");
}

main()
  .catch((e) => {
    console.error(`Lỗi: ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
