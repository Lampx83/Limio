/**
 * Gắn ảnh bìa MICRO4ASIA: tải JPEG lên tầng public (course-covers/<courseId>/…) rồi đặt coverUrl qua updateCourse
 * (có kiểm quyền + nhật ký). Idempotent: khoá đã có coverUrl thì bỏ qua, trừ khi --force.
 *   node --env-file=<env> --import tsx attach-covers.ts <dir> [--dry-run] [--force]
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { updateCourse } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { courseCoverKey } from "../src/lib/storage-keys";
import { courseCoverFilename, courseCoverUrlFromFilename } from "../src/lib/courseCover";

async function main() {
const dir = process.argv[2]!;
const dry = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const list: Array<{ slug: string; no: string }> = JSON.parse(await readFile(join(dir, "list.json"), "utf8"));
for (const { slug, no } of list) {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug }, select: { id: true, coverUrl: true } });
  const owner = await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: course.id, role: "owner" }, select: { userId: true } });
  if (course.coverUrl && !force) { console.log(`= ${slug} đã có ${course.coverUrl}`); continue; }
  const buf = await readFile(join(dir, `${no}.jpg`));
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error(`${no}.jpg không phải JPEG`);
  const filename = courseCoverFilename(course.id, "image/jpeg");
  const url = courseCoverUrlFromFilename(filename);
  if (dry) { console.log(`(dry) ${slug} ← ${no}.jpg ${buf.length} B → ${url}`); continue; }
  const key = courseCoverKey(course.id, filename);
  await storageFor(key).put(key.key, buf, "image/jpeg");
  await updateCourse(owner.userId, course.id, { coverUrl: url }, prisma);
  console.log(`✔ ${slug} → ${url}`);
}
await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
