/**
 * Chọn khoá dùng giao diện bài học HSK (đặt cài đặt hệ thống `lesson_decor.hsk_slugs`).
 *   pnpm --filter @feedbackme/core-lms exec tsx scripts/set-hsk-decor.ts --slugs hsk-3-bai-1-8-vi,hsk-3-bai-1-8
 *   ... --show      chỉ in giá trị hiện tại
 *   ... --clear     xoá (không khoá nào dùng)
 * Chạy với DATABASE_URL của môi trường cần đặt (dev mặc định; prod qua .env.prod-import như các script nhập khoá).
 */
import { prisma } from "@feedbackme/db";

const KEY = "lesson_decor.hsk_slugs";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cur = await prisma.siteSetting.findUnique({ where: { key: KEY } });
  if (process.argv.includes("--show") || (!arg("--slugs") && !process.argv.includes("--clear"))) {
    console.log(`${KEY} = ${cur ? JSON.stringify(cur.value) : "(chưa đặt)"}`);
    return;
  }
  if (process.argv.includes("--clear")) {
    if (cur) await prisma.siteSetting.delete({ where: { key: KEY } });
    console.log("Đã xoá: không khoá nào dùng giao diện HSK.");
    return;
  }
  const slugs = arg("--slugs")!.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const found = await prisma.course.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true } });
  const missing = slugs.filter((s) => !found.some((c) => c.slug === s));
  if (missing.length) console.warn(`⚠ Không thấy khoá có slug: ${missing.join(", ")} (vẫn lưu; khoá tạo sau sẽ nhận).`);
  await prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(slugs) }, update: { value: JSON.stringify(slugs) } });
  console.log(`Đã đặt ${KEY} = ${JSON.stringify(slugs)}`);
  for (const c of found) console.log(`  ✔ ${c.slug} — ${c.title}`);
}

main().finally(() => prisma.$disconnect());
