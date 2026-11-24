/**
 * Tạo (và xuất bản) combo khoá học từ tệp JSON — dùng tới khi có giao diện admin (docs/tieu-chi/combo-khoa-hoc.md).
 *
 *   pnpm create:bundle -- --file combo.json --admin admin@example.com [--publish] [--apply]
 *
 * combo.json: { "slug": "hsk-4-tron-bo", "title": "Limio HSK4 (3.0) - Trọn bộ 5 quyển", "description": "<p>..</p>",
 *               "priceCents": 799000, "originalPriceCents": 2995000, "durationMonths": 12,
 *               "courseSlugs": ["hsk-4-quyen-1", "...", "hsk-4-quyen-5"], "coverUrl": "/api/course-covers/..." }
 * Không có --apply thì chỉ in việc sẽ làm. Cần quyền admin nền tảng (createBundle kiểm lại).
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createBundle, publishBundle } from "../src/courses/bundles";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = arg("file");
  const adminEmail = arg("admin");
  if (!file || !adminEmail) throw new Error("Cần --file <combo.json> và --admin <email>");
  const apply = process.argv.includes("--apply");
  const cfg = JSON.parse(readFileSync(file, "utf8")) as {
    slug: string;
    title: string;
    description?: string;
    coverUrl?: string | null;
    priceCents: number;
    originalPriceCents?: number | null;
    durationMonths: number | null;
    courseSlugs: string[];
  };

  const admin = await prisma.user.findFirst({ where: { email: adminEmail }, select: { id: true } });
  if (!admin) throw new Error(`Không thấy ${adminEmail}`);
  const courses = await prisma.course.findMany({
    where: { slug: { in: cfg.courseSlugs } },
    select: { id: true, slug: true, status: true },
  });
  const ordered = cfg.courseSlugs.map((slug) => {
    const c = courses.find((x) => x.slug === slug);
    if (!c) throw new Error(`Không thấy khoá ${slug}`);
    return c;
  });
  console.log(`Combo ${cfg.slug}: ${ordered.length} khoá, giá ${cfg.priceCents} (gốc ${cfg.originalPriceCents ?? "-"}), hạn ${cfg.durationMonths ?? "vĩnh viễn"} tháng`);
  for (const c of ordered) console.log(`  - ${c.slug} [${c.status}]`);

  const exists = await prisma.courseBundle.findUnique({ where: { slug: cfg.slug }, select: { id: true } });
  if (exists) {
    console.log(`BỎ QUA tạo: slug đã tồn tại (${exists.id})`);
    return;
  }
  if (!apply) {
    console.log("Chạy thử xong (chưa ghi). Thêm --apply để thực hiện.");
    return;
  }
  const b = await createBundle(admin.id, {
    slug: cfg.slug,
    title: cfg.title,
    description: cfg.description,
    coverUrl: cfg.coverUrl ?? null,
    priceCents: cfg.priceCents,
    originalPriceCents: cfg.originalPriceCents ?? null,
    durationMonths: cfg.durationMonths,
    courseIds: ordered.map((c) => c.id),
  });
  console.log(`ĐÃ TẠO ${b.id}`);
  if (process.argv.includes("--publish")) {
    await publishBundle(admin.id, b.id);
    console.log("Đã xuất bản.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
