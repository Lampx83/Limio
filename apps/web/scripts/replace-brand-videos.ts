/**
 * Thay video bài giảng của một khoá bằng bản đã gắn logo NEU + Micro4Asia.
 *
 *   tsx scripts/replace-brand-videos.ts <course-slug> <dir> [--dry-run] [--by-duration | --map map.json]
 *
 * Mặc định: <dir> chứa <tên-tệp-video-hiện-có-không-đuôi>.mp4 (tên tệp trong URL `/api/lesson-media/videos/<tên>.mp4`).
 * `--by-duration`: tên tệp trong <dir> tuỳ ý; ghép mỗi khối video với tệp có thời lượng khớp `payload.durationSec`
 * (sai số ≤ 0,6 giây: durationSec là số giây làm tròn). Khối nào không có đúng MỘT tệp khớp, hoặc tệp bị hai khối cùng nhận → dừng, không ghi gì.
 * `--map map.json`: {"<contentItemId>": "<đường dẫn tệp mới>"} — ghép tường minh (dùng khi thời lượng trùng nhau nên `--by-duration` không phân biệt được).
 * Với mỗi khối ghép được: tải bản mới lên storage rồi đổi `payload.url` (giữ nguyên tiêu đề, caption, thời lượng, cuepoint…).
 * Bản cũ KHÔNG bị xoá khỏi kho (để hoàn tác).
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { updateContentItem } from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonVideoKey } from "../src/lib/storage-keys";

const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

async function main() {
  const [slug, dir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dryRun = process.argv.includes("--dry-run");
  if (!slug || !dir) {
    console.error("usage: replace-brand-videos.ts <course-slug> <dir> [--dry-run]");
    process.exit(1);
  }
  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) throw new Error(`no course ${slug}`);
  const owner = await prisma.courseInstructor.findFirst({ where: { courseId: course.id, role: "owner" }, select: { userId: true } });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;

  // Chỉ đọc khối video: prod có thể chứa loại nội dung mới hơn bản client này mà Prisma không đọc được.
  const items = await prisma.contentItem.findMany({
    where: { type: "video", lesson: { module: { courseId: course.id } } },
    select: { id: true, payload: true, lesson: { select: { title: true } } },
  });
  const mi = process.argv.indexOf("--map");
  const byMap = mi >= 0;
  const byDuration = process.argv.includes("--by-duration") || byMap;
  const plan = new Map<string, string>(); // item id → tệp
  if (byMap) {
    const m = JSON.parse(await readFile(process.argv[mi + 1]!, "utf8")) as Record<string, string>;
    for (const [id, f] of Object.entries(m)) {
      if (!existsSync(f)) throw new Error(`missing: ${f}`);
      plan.set(id, f);
    }
  } else if (byDuration) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".mp4")).map((f) => ({
      f,
      sec: parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(dir, f)], { encoding: "utf8" })),
    }));
    const taken = new Map<string, string>();
    for (const it of items) {
      const want = (it.payload as { durationSec?: number }).durationSec;
      if (typeof want !== "number") throw new Error(`"${it.lesson.title}": không có durationSec`);
      const hits = files.filter((x) => Math.abs(x.sec - want) <= 0.6);
      if (hits.length !== 1) throw new Error(`"${it.lesson.title}" (${want}s): ${hits.length} tệp khớp thời lượng`);
      const prev = taken.get(hits[0]!.f);
      if (prev) throw new Error(`tệp ${hits[0]!.f} khớp cả "${prev}" và "${it.lesson.title}"`);
      taken.set(hits[0]!.f, it.lesson.title);
      plan.set(it.id, join(dir, hits[0]!.f));
    }
  }
  let done = 0;
  for (const it of items) {
    const p = it.payload as { url?: string } & Record<string, unknown>;
    let file: string;
    if (byDuration) {
      const f = plan.get(it.id);
      if (!f) continue;
      file = f;
    } else {
      const m = /^\/api\/lesson-media\/videos\/(.+)\.mp4$/.exec(p.url ?? "");
      if (!m) continue;
      file = join(dir, `${m[1]}.mp4`);
      if (!existsSync(file)) continue;
    }
    if (dryRun) {
      console.log(`(dry-run) "${it.lesson.title}" ← ${file.split("/").pop()}`);
      continue;
    }
    const buf = await readFile(file);
    if (buf.byteLength === 0 || buf.byteLength > MAX_VIDEO_BYTES) throw new Error(`bad size ${buf.byteLength}: ${file}`);
    const now = new Date();
    const filename = `${actor}-${now.getTime()}-${randomBytes(8).toString("hex")}.mp4`;
    const key = lessonVideoKey(now, filename);
    await storageFor(key).put(key.key, buf, "video/mp4");
    await updateContentItem(actor, it.id, { payload: { ...p, url: `/api/lesson-media/videos/${filename}` } }, prisma);
    done++;
    console.log(`✔ "${it.lesson.title}" → ${filename} (${Math.round(buf.byteLength / 1e6)} MB)`);
  }
  console.log(dryRun ? "\nDry run — nothing written." : `\nĐã thay ${done} video.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
