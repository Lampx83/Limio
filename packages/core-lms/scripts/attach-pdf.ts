/**
 * Gắn một file PDF vào bài học đã có, kèm (tuỳ chọn) bật "Học liệu có bản quyền" và sinh lô mã kích hoạt.
 * Dùng để dựng khoá mẫu cho nhà xuất bản; chỉ chạy được với kho tệp trên đĩa (máy dev), không ghi lên S3.
 *
 *   pnpm --filter @feedbackme/core-lms attach:pdf --course on-thi-vao-10-toan-mau --lesson "biệt thức" \
 *     --owner gv@example.com --file ./doc.pdf --title "Bản đọc thử" --protect --batch "Mẫu cho NXB" --count 5 --months 12 --dry-run
 *
 * File được đặt đúng chỗ route `/api/lesson-media/pdfs` đặt (`uploads/public/lesson-media/pdfs/yyyy/mm/<tên>`),
 * tên theo khuôn `<userId>-<ms>-<hex>.pdf` để `lessonPdfKeyFromFilename` tìm lại được. Khối được tạo qua
 * createContentItem như UI giảng viên, nên payload được zod kiểm. Chạy lại không sinh trùng (khối PDF cùng
 * tiêu đề thì bỏ qua). Mã của lô chỉ in ra khi thêm `--print-codes`: mã tự cấp quyền học, đừng để lọt vào log.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@feedbackme/db";
import { createContentItem } from "../src/courses/contents";
import { setCourseProtectedMedia } from "../src/courses/protectedMedia";
import { createAccessCodeBatch, exportBatchCodesCsv } from "../src/learning/accessCodeBatch";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const slug = arg("course");
  const lessonKey = arg("lesson");
  const ownerEmail = arg("owner");
  const file = arg("file");
  const title = arg("title") ?? "Tài liệu PDF";
  const dryRun = flag("dry-run");
  if (!slug || !lessonKey || !ownerEmail || !file) {
    console.error("Thiếu tham số: --course --lesson --owner --file [--title] [--protect] [--batch <tên> --count <n> --months <n>] [--dry-run]");
    process.exit(1);
  }

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không có tài khoản ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (!course) throw new Error(`Không có khoá slug=${slug}`);
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id }, title: { contains: lessonKey, mode: "insensitive" } },
    select: { id: true, title: true, contentItems: { select: { type: true, payload: true, orderIndex: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (lessons.length !== 1) throw new Error(`Khớp ${lessons.length} bài với "${lessonKey}": ${lessons.map((l) => l.title).join(" | ")}`);
  const lesson = lessons[0]!;

  const existing = lesson.contentItems.find(
    (c) => c.type === "pdf" && (c.payload as { title?: string } | null)?.title === title,
  );
  console.log(`${course.title} › ${lesson.title}`);

  if (existing) {
    console.log(`= Đã có khối PDF "${title}", bỏ qua bước gắn file.`);
  } else if (!dryRun) {
    const buf = await readFile(file);
    if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error("File không phải PDF");
    const now = new Date();
    const filename = `${owner.id}-${now.getTime()}-${randomBytes(8).toString("hex")}.pdf`;
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const root = process.env.UPLOADS_ROOT ?? path.resolve(process.cwd(), "../../apps/web/uploads");
    const dest = path.join(root, "public", "lesson-media", "pdfs", yyyy, mm, filename);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    // Xếp ngay sau khối chữ cuối của bài, không chen đầu bài.
    const orderIndex = Math.max(-1, ...lesson.contentItems.map((c) => c.orderIndex)) + 1;
    await createContentItem(owner.id, lesson.id, {
      type: "pdf",
      orderIndex,
      payload: { url: `/api/lesson-media/pdfs/${filename}`, title },
    });
    console.log(`✔ Gắn PDF ${buf.length} byte vào bài (khối thứ ${orderIndex}).`);
  } else {
    console.log(`(dry-run) sẽ gắn ${file} làm khối PDF "${title}".`);
  }

  if (flag("protect") && !dryRun) {
    const r = await setCourseProtectedMedia(owner.id, course.id, true);
    console.log(`✔ Học liệu có bản quyền: bật, ${r.files} file được bảo vệ.`);
  }

  const batchLabel = arg("batch");
  if (batchLabel && !dryRun) {
    const have = await prisma.courseAccessCodeBatch.findFirst({ where: { courseId: course.id, label: batchLabel }, select: { id: true } });
    if (have) {
      console.log(`= Lô "${batchLabel}" đã có, bỏ qua.`);
    } else {
      const count = Number(arg("count") ?? 5);
      const months = arg("months") ? Number(arg("months")) : undefined;
      const b = await createAccessCodeBatch(course.id, owner.id, {
        label: batchLabel,
        count,
        accessDurationMonths: months,
        note: "Lô mã mẫu để nhà xuất bản thử nhập mã",
      });
      console.log(`✔ Lô "${batchLabel}": ${b.count} mã, truy cập ${months ? months + " tháng" : "vĩnh viễn"}.`);
      if (flag("print-codes")) {
        const out = await exportBatchCodesCsv(course.id, b.batchId, owner.id, { scope: "all" });
        console.log(out.csv);
      }
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
