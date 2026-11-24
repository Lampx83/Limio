/**
 * Đặt ảnh bìa cho một khoá (tệp PNG/JPG/WebP ≤ 5 MB): tải lên kho như route /api/instructor/courses/[id]/cover rồi ghi coverUrl.
 *   tsx --env-file=<env> scripts/set-course-cover.ts --course hsk-1-goc --file bia.png [--dry-run]
 * Tệp bìa cũ (nếu có) được dọn sau khi bìa mới đã ghi.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { storageFor } from "../src/lib/storage";
import { courseCoverKey, courseCoverKeyFromFilename } from "../src/lib/storage-keys";
import { COURSE_COVER_MAX_BYTES, courseCoverFilename } from "../src/lib/courseCover";

const PREFIX = "/api/course-covers/"; // trùng COURSE_COVER_PATH_PREFIX (shared-types bản build có thể chưa có hằng này)
const urlOf = (f: string) => `${PREFIX}${f}`;
const fileOf = (u: string | null) => (u && u.startsWith(PREFIX) && /^[A-Za-z0-9._-]+$/.test(u.slice(PREFIX.length)) ? u.slice(PREFIX.length) : null);

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const slug = arg("course"), file = arg("file"), dry = process.argv.includes("--dry-run");
  if (!slug || !file) throw new Error("usage: --course <slug> --file <ảnh> [--dry-run]");
  const buf = readFileSync(file);
  const mime = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
  if (buf.byteLength === 0 || buf.byteLength > COURSE_COVER_MAX_BYTES) throw new Error(`ảnh ${buf.byteLength} byte không hợp lệ`);
  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true, title: true, coverUrl: true } });
  if (!course) throw new Error(`không có khoá ${slug}`);
  const filename = courseCoverFilename(course.id, mime);
  const key = courseCoverKey(course.id, filename);
  console.log(`${course.title}: bìa hiện tại ${course.coverUrl ?? "(trống)"} → ${urlOf(filename)} (${buf.byteLength} byte)`);
  if (dry) return console.log("dry-run — chưa ghi.");
  await storageFor(key).put(key.key, buf, mime);
  await prisma.course.update({ where: { id: course.id }, data: { coverUrl: urlOf(filename) } });
  const old = fileOf(course.coverUrl);
  const oldKey = old ? courseCoverKeyFromFilename(old) : null;
  if (oldKey) await storageFor(oldKey).delete(oldKey.key).catch(() => undefined);
  console.log("✔ đã đặt bìa");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
