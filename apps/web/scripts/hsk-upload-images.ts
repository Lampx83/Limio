/**
 * Tải ảnh minh hoạ HSK (webp đã nén) lên kho ảnh bài học, in ra bảng tên-gốc → URL.
 *
 *   tsx --env-file=.env scripts/hsk-upload-images.ts <dir> <actor-email> <out.json>
 *
 * Đi đúng đường của POST /api/lesson-media/images: khoá `lessonImageKey`, tên tệp
 * `<userId>-<ms>-<hex>.<ext>`, URL `/api/lesson-media/images/<tên>`. Không ghi DB:
 * việc gắn ảnh vào bài là của `import-course` / `update-lesson` (markdown `![alt](url)`).
 * Chạy lại sẽ tải lại và cho URL mới; muốn idempotent thì truyền `<out.json>` đã có —
 * tên nào đã có trong đó thì bỏ qua.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { storageFor } from "../src/lib/storage";
import { lessonImageKey } from "../src/lib/storage-keys";

async function main() {
  const [dir, email, outFile] = process.argv.slice(2);
  if (!dir || !email || !outFile) {
    console.error("usage: hsk-upload-images.ts <dir> <actor-email> <out.json>");
    process.exit(1);
  }
  const actor = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!actor) throw new Error(`no user ${email}`);

  const map: Record<string, string> = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".webp")).sort()) {
    const base = f.slice(0, -5);
    if (map[base]) {
      console.log("giữ nguyên", base);
      continue;
    }
    const buf = readFileSync(join(dir, f));
    if (buf.subarray(0, 4).toString() !== "RIFF" || buf.subarray(8, 12).toString() !== "WEBP") {
      throw new Error(`không phải webp: ${f}`);
    }
    const now = new Date();
    const filename = `${actor.id}-${now.getTime()}-${randomBytes(8).toString("hex")}.webp`;
    const key = lessonImageKey(now, filename);
    await storageFor(key).put(key.key, buf, "image/webp");
    map[base] = `/api/lesson-media/images/${filename}`;
    console.log("đã tải", base, Math.round(buf.length / 1024), "KB");
  }
  writeFileSync(outFile, JSON.stringify(map, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
