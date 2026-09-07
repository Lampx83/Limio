/**
 * Gắn một video (YouTube/Vimeo…) lên đầu một bài học đã có trên hệ thống.
 *
 *   pnpm --filter @feedbackme/core-lms attach:video -- \
 *     --course ky-nang-mem --lesson "Bài 1.1" --owner gv@example.com \
 *     --url https://www.youtube.com/watch?v=... --title "…" --duration 633 --dry-run
 *
 * Đi qua createContentItem/updateContentItem như UI giảng viên, nên payload
 * được zod kiểm trước khi chạm DB.
 *
 * Video được chèn ở orderIndex 0 và mọi khối đang có bị đẩy xuống một bậc —
 * người học thấy video trước khi đọc, giống bố cục các khoá đang chạy.
 *
 * Khối video KHÔNG nằm trong manifest học liệu, nhưng `update-lesson` chỉ so
 * và ghi đè các khối `richtext` nên nó sống sót qua các lần cập nhật bài.
 */
import { prisma } from "@feedbackme/db";
import { createContentItem, updateContentItem } from "../src/courses/contents";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const slug = arg("course");
  const lessonKey = arg("lesson");
  const ownerEmail = arg("owner");
  const url = arg("url");
  const duration = arg("duration");
  const dryRun = process.argv.includes("--dry-run");
  if (!slug || !lessonKey || !ownerEmail || !url) {
    console.error("Thiếu tham số: --course --lesson --owner --url [--duration <giây>] [--dry-run]");
    process.exit(1);
  }

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không có tài khoản ${ownerEmail}`);

  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (!course) throw new Error(`Không có khoá slug=${slug}`);

  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id }, title: { contains: lessonKey } },
    select: { id: true, title: true, contentItems: { select: { id: true, type: true, orderIndex: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (lessons.length !== 1) {
    throw new Error(`Khớp ${lessons.length} bài với "${lessonKey}": ${lessons.map((l) => l.title).join(" | ")}`);
  }
  const lesson = lessons[0]!;

  const already = lesson.contentItems.find((c) => c.type === "video");
  console.log(`${course.title} / ${lesson.title}`);
  console.log(`  khối hiện có: ${lesson.contentItems.map((c) => c.type).join(", ")}`);
  if (already) {
    console.log("  ! bài này đã có khối video — dừng, không chèn thêm.");
    return;
  }
  console.log(`  + video ở vị trí đầu: ${url}${duration ? ` (${duration}s)` : ""}`);
  console.log(`  ~ đẩy ${lesson.contentItems.length} khối hiện có xuống một bậc`);
  if (dryRun) {
    console.log("\n[dry-run] Không ghi gì.");
    return;
  }

  // Đẩy từ dưới lên để không đụng chỉ số đang dùng.
  for (const item of [...lesson.contentItems].reverse()) {
    await updateContentItem(owner.id, item.id, { orderIndex: item.orderIndex + 1 });
  }
  await createContentItem(owner.id, lesson.id, {
    type: "video",
    orderIndex: 0,
    payload: { url, ...(duration ? { durationSec: Number(duration) } : {}) },
  });
  console.log("\n✔ Đã gắn video.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
