/**
 * Sắp lại thứ tự khối trong bài: **mục tiêu bài học lên trước, rồi tới video,
 * rồi phần còn lại.**
 *
 *   pnpm order:blocks -- --course ky-nang-mem --owner gv@example.com --dry-run
 *
 * Khối đầu tiên do import:course sinh ra là dải thông tin + hộp "Học xong bài
 * này, bạn có thể…". Người học cần biết bài này để làm gì trước khi quyết định
 * bấm play — nên nó phải đứng trên video, không phải dưới.
 *
 * Chỉ đổi orderIndex, không đụng nội dung.
 */
import { prisma } from "@feedbackme/db";
import { updateContentItem } from "../src/courses/contents";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const slug = arg("course");
  const ownerEmail = arg("owner");
  const only = arg("lesson");
  const dryRun = process.argv.includes("--dry-run");
  if (!slug || !ownerEmail) {
    console.error("Thiếu tham số: --course --owner [--lesson <chuỗi>] [--dry-run]");
    process.exit(1);
  }
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không có tài khoản ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (!course) throw new Error(`Không có khoá slug=${slug}`);

  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id }, ...(only ? { title: { contains: only } } : {}) },
    select: {
      id: true,
      title: true,
      module: { select: { orderIndex: true } },
      orderIndex: true,
      contentItems: { select: { id: true, type: true, orderIndex: true }, orderBy: { orderIndex: "asc" } },
    },
  });
  lessons.sort((a, b) => a.module.orderIndex - b.module.orderIndex || a.orderIndex - b.orderIndex);

  let changed = 0;
  for (const lesson of lessons) {
    const items = lesson.contentItems;
    if (items.length === 0) continue;
    const videos = items.filter((c) => c.type === "video");
    if (videos.length === 0) continue;
    const rest = items.filter((c) => c.type !== "video");
    const head = rest[0];
    if (!head) continue;

    const wanted = [head, ...videos, ...rest.slice(1)];
    const same = wanted.every((it, i) => items[i]?.id === it.id);
    if (same) continue;

    console.log(`${lesson.title}`);
    console.log(`  trước: ${items.map((c) => c.type).join(", ")}`);
    console.log(`  sau:   ${wanted.map((c) => c.type).join(", ")}`);
    changed++;
    if (dryRun) continue;

    // Dời tạm ra khỏi vùng đang dùng rồi mới đặt lại, tránh đụng chỉ số.
    for (const [i, it] of wanted.entries()) {
      await updateContentItem(owner.id, it.id, { orderIndex: i + 1000 });
    }
    for (const [i, it] of wanted.entries()) {
      await updateContentItem(owner.id, it.id, { orderIndex: i });
    }
  }
  console.log(`\n${dryRun ? "[dry-run] " : ""}${changed}/${lessons.length} bài cần sắp lại.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
