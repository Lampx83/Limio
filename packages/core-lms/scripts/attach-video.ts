/**
 * Gắn video (YouTube/Vimeo…) vào một bài học đã có trên hệ thống.
 *
 *   pnpm attach:video -- --course ky-nang-mem --lesson "Bài 1.1" --owner gv@example.com \
 *     --url https://youtu.be/aaa --url https://youtu.be/bbb --dry-run
 *
 * Đi qua createContentItem/updateContentItem/deleteContentItem như UI giảng
 * viên, nên payload được zod kiểm trước khi chạm DB.
 *
 * Video xếp ở đầu bài (orderIndex 0, 1, …) và mọi khối chữ bị đẩy xuống —
 * người học xem trước khi đọc, giống bố cục các khoá đang chạy.
 *
 * Khối video KHÔNG nằm trong manifest học liệu, nhưng `update-lesson` chỉ so
 * và ghi đè các khối `richtext` nên nó sống sót qua các lần cập nhật bài.
 *
 * `--url` lặp được. URL đã có sẵn trong bài thì bỏ qua, nên chạy lại không
 * sinh trùng. `--replace` gỡ hết video cũ trước khi gắn bộ mới.
 */
import { prisma } from "@feedbackme/db";
import { createContentItem, updateContentItem, deleteContentItem } from "../src/courses/contents";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]!);
  });
  return out;
}

async function main() {
  const slug = arg("course");
  const lessonKey = arg("lesson");
  const ownerEmail = arg("owner");
  const urls = args("url");
  const dryRun = process.argv.includes("--dry-run");
  const replace = process.argv.includes("--replace");
  if (!slug || !lessonKey || !ownerEmail || urls.length === 0) {
    console.error("Thiếu tham số: --course --lesson --owner --url <link> [--url <link>…] [--replace] [--dry-run]");
    process.exit(1);
  }

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không có tài khoản ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (!course) throw new Error(`Không có khoá slug=${slug}`);

  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id }, title: { contains: lessonKey } },
    select: {
      id: true,
      title: true,
      contentItems: { select: { id: true, type: true, orderIndex: true, payload: true }, orderBy: { orderIndex: "asc" } },
    },
  });
  if (lessons.length !== 1) {
    throw new Error(`Khớp ${lessons.length} bài với "${lessonKey}": ${lessons.map((l) => l.title).join(" | ")}`);
  }
  const lesson = lessons[0]!;
  const existingVideos = lesson.contentItems.filter((c) => c.type === "video");
  const existingUrls = new Set(
    existingVideos.map((c) => (c.payload as { url?: string } | null)?.url).filter(Boolean) as string[],
  );

  const toAdd = replace ? urls : urls.filter((u) => !existingUrls.has(u));
  console.log(`${course.title} / ${lesson.title}`);
  console.log(`  khối hiện có: ${lesson.contentItems.map((c) => c.type).join(", ") || "(trống)"}`);
  if (replace && existingVideos.length) console.log(`  − gỡ ${existingVideos.length} video cũ`);
  if (toAdd.length === 0) {
    console.log("  = mọi video đã có sẵn, không cần làm gì.");
    return;
  }
  toAdd.forEach((u, i) => console.log(`  + video #${i + 1}: ${u}`));
  if (dryRun) {
    console.log("\n[dry-run] Không ghi gì.");
    return;
  }

  if (replace) {
    for (const v of existingVideos) await deleteContentItem(owner.id, v.id);
  }
  const keep = lesson.contentItems.filter((c) => !(replace && c.type === "video"));
  // Đẩy từ dưới lên để không đụng chỉ số đang dùng.
  for (const [i, item] of [...keep].reverse().entries()) {
    void i;
    await updateContentItem(owner.id, item.id, { orderIndex: item.orderIndex + toAdd.length + 100 });
  }
  for (const [i, u] of toAdd.entries()) {
    await createContentItem(owner.id, lesson.id, { type: "video", orderIndex: i, payload: { url: u } });
  }
  // Dồn lại chỉ số cho liền mạch.
  const after = await prisma.contentItem.findMany({
    where: { lessonId: lesson.id },
    select: { id: true, orderIndex: true },
    orderBy: { orderIndex: "asc" },
  });
  for (const [i, item] of after.entries()) {
    if (item.orderIndex !== i) await updateContentItem(owner.id, item.id, { orderIndex: i });
  }
  console.log(`\n✔ Đã gắn ${toAdd.length} video.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
