/**
 * Đưa một nhóm khoá vào bán có phí: gói truy cập theo thời hạn, mô tả, xem thử vài bài, học liệu bản quyền.
 *
 *   pnpm setup:paid-courses -- --plan plan.json --admin admin@example.com [--apply]
 *
 * plan.json:
 *   { "owner": "gv@example.com",
 *     "plan": { "label": "1 năm", "durationMonths": 12, "priceCents": 199000, "currency": "VND" },
 *     "courses": [ { "slug": "...", "description": "<p>..</p>",
 *                    "previewLessons": { "module": 0, "titlePrefixes": ["Bài khoá 1", "Bài khoá 2"] } } ] }
 *
 * Mỗi khoá (idempotent, chạy lại không nhân đôi):
 *   - enrollMode = open (tự ghi danh/mua), publicAccess = false (không còn đọc tự do), currency theo gói;
 *   - description thay bằng bản trong kế hoạch;
 *   - đúng các bài khớp `previewLessons` có previewable = true, bài còn lại của khoá previewable = false;
 *   - có đúng một gói truy cập đang hoạt động cùng nhãn (tạo qua createCourseAccessPlan: cần admin nền tảng);
 *   - bật protectedMedia và quét lại bảng tra tệp được bảo vệ (bài xem thử cố ý không được bảo vệ).
 * Không có --apply thì chỉ in việc sẽ làm.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createCourseAccessPlan } from "../src/learning/courseAccess";
import { setCourseProtectedMedia } from "../src/courses/protectedMedia";
import { isAdmin } from "../src/auth/roles";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface Plan {
  owner: string;
  plan: { label: string; durationMonths: number | null; priceCents: number; currency: "VND" | "USD" };
  /** Giá gốc hiển thị gạch ngang (cột Course.originalPriceCents — cần migration 20261124160000 đã chạy trên máy chủ). */
  originalPriceCents?: number | null;
  courses: Array<{
    slug: string;
    description: string;
    previewLessons: { module: number; titlePrefixes: string[] };
  }>;
}

async function main() {
  const planPath = arg("plan");
  const adminEmail = arg("admin");
  if (!planPath || !adminEmail) throw new Error("Cần --plan <tệp.json> và --admin <email>");
  const apply = process.argv.includes("--apply");
  const cfg = JSON.parse(readFileSync(planPath, "utf8")) as Plan;

  const admin = await prisma.user.findFirst({ where: { email: adminEmail }, select: { id: true } });
  if (!admin) throw new Error(`Không thấy ${adminEmail}`);
  if (!(await isAdmin(admin.id))) throw new Error(`${adminEmail} không phải admin nền tảng (cần để tạo gói truy cập)`);
  const owner = await prisma.user.findFirst({ where: { email: cfg.owner }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy chủ khoá ${cfg.owner}`);

  for (const c of cfg.courses) {
    const course = await prisma.course.findUnique({
      where: { slug: c.slug },
      select: { id: true, enrollMode: true, publicAccess: true, protectedMedia: true, currency: true },
    });
    if (!course) throw new Error(`Không thấy khoá ${c.slug}`);

    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId: course.id } },
      select: { id: true, title: true, previewable: true, module: { select: { orderIndex: true } } },
    });
    const wantPreview = lessons.filter(
      (l) => l.module.orderIndex === c.previewLessons.module && c.previewLessons.titlePrefixes.some((p) => l.title.startsWith(p)),
    );
    if (wantPreview.length !== c.previewLessons.titlePrefixes.length) {
      throw new Error(`${c.slug}: tìm thấy ${wantPreview.length} bài xem thử, cần ${c.previewLessons.titlePrefixes.length}`);
    }
    const plans = await prisma.courseAccessPlan.findMany({ where: { courseId: course.id, isActive: true } });
    const hasPlan = plans.some((p) => p.label === cfg.plan.label);

    console.log(
      `\n== ${c.slug}\n   enrollMode ${course.enrollMode}→open, publicAccess ${course.publicAccess}→false, protectedMedia ${course.protectedMedia}→true` +
        `\n   xem thử: ${wantPreview.map((l) => l.title).join(" | ")}` +
        `\n   gói "${cfg.plan.label}": ${hasPlan ? "đã có" : `tạo ${cfg.plan.priceCents} ${cfg.plan.currency}`}`,
    );
    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id: course.id },
        data: {
          enrollMode: "open",
          publicAccess: false,
          currency: cfg.plan.currency,
          description: c.description,
          protectedMedia: true,
          ...(cfg.originalPriceCents !== undefined ? { originalPriceCents: cfg.originalPriceCents } : {}),
        },
      });
      const keep = new Set(wantPreview.map((l) => l.id));
      await tx.lesson.updateMany({ where: { module: { courseId: course.id }, id: { in: [...keep] } }, data: { previewable: true } });
      await tx.lesson.updateMany({ where: { module: { courseId: course.id }, id: { notIn: [...keep] }, previewable: true }, data: { previewable: false } });
    });
    if (!hasPlan) await createCourseAccessPlan(admin.id, course.id, cfg.plan);
    const r = await setCourseProtectedMedia(owner.id, course.id, true);
    console.log(`   xong · tệp được bảo vệ: ${r.files}`);
  }
  console.log(apply ? "\nĐã ghi DB." : "\nChạy thử xong (chưa ghi). Thêm --apply để thực hiện.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
